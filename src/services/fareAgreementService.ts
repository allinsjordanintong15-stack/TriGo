import { OUT_OF_AREA_FARE_SETTINGS } from '@/constants/outOfAreaFareSettings';
import { COLLECTIONS, firestore } from '@/firebase';
import { FareAgreement } from '@/types';
import { calculateFareDifference } from '@/utils/fare';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';

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
 * Called when a driver expresses interest with a proposed fare.
 * Driver-side will trigger this in a later phase.
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

  const requestRef = doc(firestore, COLLECTIONS.outOfAreaRequests, input.requestId);
  await updateDoc(requestRef, {
    status: 'negotiating',
    driverId: input.driverId,
    suggestedAgreementFare: input.driverProposedFare,
    fareAgreement,
    updatedAt: serverTimestamp(),
  });

  return fareAgreement;
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
