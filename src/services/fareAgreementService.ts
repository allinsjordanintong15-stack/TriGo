import { OUT_OF_AREA_FARE_SETTINGS } from '@/constants/outOfAreaFareSettings';
import { COLLECTIONS, firestore } from '@/firebase';
import { DriverRecord, FareAgreement } from '@/types';
import { calculateFareDifference } from '@/utils/fare';
import { doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';

export class FareAgreementServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FareAgreementServiceError';
  }
}

export interface FareProposalInput {
  requestId: string;
  standardEstimatedFare: number;
  driverProposedFare: number;
  driverId: string;
}

export interface FareProposalSummary {
  standardEstimatedFare: number;
  driverProposedFare: number;
  additionalAmount: number;
  additionalPercentage: number;
}

export function summarizeFareProposal(
  standardEstimatedFare: number,
  driverProposedFare: number,
): FareProposalSummary {
  const { difference, differencePercentage } = calculateFareDifference(
    standardEstimatedFare,
    driverProposedFare,
  );

  return {
    standardEstimatedFare,
    driverProposedFare,
    additionalAmount: difference,
    additionalPercentage: differencePercentage,
  };
}

export function validateDriverProposedFare(
  standardEstimatedFare: number,
  driverProposedFare: number,
): string | null {
  if (driverProposedFare <= 0) {
    return 'Proposed fare must be greater than zero.';
  }

  if (
    OUT_OF_AREA_FARE_SETTINGS.minimumFare !== null &&
    driverProposedFare < OUT_OF_AREA_FARE_SETTINGS.minimumFare
  ) {
    return `Proposed fare must be at least ₱${OUT_OF_AREA_FARE_SETTINGS.minimumFare.toFixed(2)}.`;
  }

  const { differencePercentage } = calculateFareDifference(
    standardEstimatedFare,
    driverProposedFare,
  );

  if (
    OUT_OF_AREA_FARE_SETTINGS.maximumAdditionalPercentage !== null &&
    differencePercentage > OUT_OF_AREA_FARE_SETTINGS.maximumAdditionalPercentage
  ) {
    return `Proposed fare exceeds the maximum allowed additional amount (${OUT_OF_AREA_FARE_SETTINGS.maximumAdditionalPercentage}%).`;
  }

  return null;
}

/**
 * The driver proposes a fare on an open request. One batch claims the request
 * (negotiating, with the proposal) and reserves the driver (currentRequestId, not
 * available); Firestore rules require both in the same commit. The passenger still has
 * to accept.
 */
export async function createProposal(input: FareProposalInput): Promise<FareAgreement> {
  if (!OUT_OF_AREA_FARE_SETTINGS.allowDriverNegotiation) {
    throw new FareAgreementServiceError('Driver fare negotiation is not enabled.');
  }

  const validationError = validateDriverProposedFare(
    input.standardEstimatedFare,
    input.driverProposedFare,
  );

  if (validationError) {
    throw new FareAgreementServiceError(validationError);
  }

  const fareAgreement: FareAgreement = {
    standardEstimatedFare: input.standardEstimatedFare,
    driverProposedFare: input.driverProposedFare,
    agreedFare: input.driverProposedFare,
    agreedByPassenger: false,
    agreedByDriver: true,
    agreedAt: null,
  };

  const batch = writeBatch(firestore);
  batch.update(doc(firestore, COLLECTIONS.outOfAreaRequests, input.requestId), {
    status: 'negotiating',
    driverId: input.driverId,
    suggestedAgreementFare: input.driverProposedFare,
    fareAgreement,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(firestore, COLLECTIONS.drivers, input.driverId), {
    currentRequestId: input.requestId,
    isAvailable: false,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    if ((error as { code?: string }).code === 'permission-denied') {
      // Taken by another driver, cancelled or expired, or this driver is no longer
      // online, available and free.
      throw new FareAgreementServiceError(
        'Unable to send your proposal. The request may have been taken or expired, or you are no longer online and available.',
      );
    }
    throw new FareAgreementServiceError(
      'Unable to send your proposal. Please check your internet connection and try again.',
    );
  }

  return fareAgreement;
}

/**
 * The driver withdraws a proposal the passenger has not accepted yet. One batch returns
 * the request to the open pool and releases the driver (available again if still online
 * and verified).
 */
export async function withdrawProposal(
  requestId: string,
  driverRecord: DriverRecord,
): Promise<void> {
  const canBeAvailable = driverRecord.isOnline && driverRecord.isVerified;

  const batch = writeBatch(firestore);
  batch.update(doc(firestore, COLLECTIONS.outOfAreaRequests, requestId), {
    status: 'searching',
    driverId: null,
    suggestedAgreementFare: null,
    fareAgreement: null,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(firestore, COLLECTIONS.drivers, driverRecord.driverId), {
    currentRequestId: null,
    isOnline: canBeAvailable,
    isAvailable: canBeAvailable,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    if ((error as { code?: string }).code === 'permission-denied') {
      throw new FareAgreementServiceError(
        'Unable to withdraw. The passenger may have already accepted or cancelled this request.',
      );
    }
    throw new FareAgreementServiceError(
      'Unable to withdraw your proposal. Please check your internet connection and try again.',
    );
  }
}

export async function acceptProposal(
  requestId: string,
  currentAgreement: FareAgreement,
): Promise<void> {
  const requestRef = doc(firestore, COLLECTIONS.outOfAreaRequests, requestId);

  const updatedAgreement: FareAgreement = {
    ...currentAgreement,
    agreedFare: currentAgreement.driverProposedFare,
    agreedByPassenger: true,
    agreedAt: new Date(),
  };

  await updateDoc(requestRef, {
    status: 'accepted',
    agreedFare: updatedAgreement.agreedFare,
    fareAgreement: {
      ...updatedAgreement,
      agreedAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  });
}

export async function declineProposal(requestId: string): Promise<void> {
  const requestRef = doc(firestore, COLLECTIONS.outOfAreaRequests, requestId);

  await updateDoc(requestRef, {
    status: 'searching',
    driverId: null,
    suggestedAgreementFare: null,
    fareAgreement: null,
    updatedAt: serverTimestamp(),
  });
}
