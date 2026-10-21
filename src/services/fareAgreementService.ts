import { COLLECTIONS, firestore } from '@/firebase';
import {
  COMMISSION_SUSPENDED_MESSAGE,
  CommissionServiceError,
  isCommissionSuspended,
} from '@/services/commissionService';
import { DriverRecord, FareAgreement } from '@/types';
import { doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';

export class FareAgreementServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FareAgreementServiceError';
  }
}

export interface FareProposalInput {
  requestId: string;
  /** The request's admin per-km fare; out-of-area fares are final at this amount. */
  standardEstimatedFare: number;
  driverId: string;
}

/**
 * The driver accepts an open request at its admin per-km fare (the fare is final; drivers
 * do not choose an amount). One batch claims the request (negotiating, with the fare in
 * the proposal fields) and reserves the driver (currentRequestId, not available);
 * Firestore rules require both in the same commit and the fare to equal
 * standardEstimatedFare. The passenger still has to confirm. A driver suspended for overdue
 * commission is refused first (the rules refuse the commit too).
 */
export async function createProposal(input: FareProposalInput): Promise<FareAgreement> {
  const fare = input.standardEstimatedFare;

  const fareAgreement: FareAgreement = {
    standardEstimatedFare: fare,
    driverProposedFare: fare,
    agreedFare: fare,
    agreedByPassenger: false,
    agreedByDriver: true,
    agreedAt: null,
  };

  const batch = writeBatch(firestore);
  batch.update(doc(firestore, COLLECTIONS.outOfAreaRequests, input.requestId), {
    status: 'negotiating',
    driverId: input.driverId,
    suggestedAgreementFare: fare,
    fareAgreement,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(firestore, COLLECTIONS.drivers, input.driverId), {
    currentRequestId: input.requestId,
    isAvailable: false,
    updatedAt: serverTimestamp(),
  });

  try {
    if (await isCommissionSuspended(input.driverId)) {
      throw new FareAgreementServiceError(COMMISSION_SUSPENDED_MESSAGE);
    }
    await batch.commit();
  } catch (error) {
    if (error instanceof FareAgreementServiceError) throw error;
    if (error instanceof CommissionServiceError) throw new FareAgreementServiceError(error.message);
    if ((error as { code?: string }).code === 'permission-denied') {
      // Taken by another driver, cancelled or expired, or this driver is no longer
      // online, available and free.
      throw new FareAgreementServiceError(
        'Unable to accept this request. It may have been taken or expired, or you are no longer online and available.',
      );
    }
    throw new FareAgreementServiceError(
      'Unable to accept this request. Please check your internet connection and try again.',
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

/**
 * Release the driver from a request that no longer holds them (declined, cancelled,
 * expired, or taken by someone else): clear `currentRequestId` and become available again
 * if still online and verified. Only the driver record changes; Firestore rules check the
 * request's state.
 */
export async function releaseOutOfAreaRequest(driverRecord: DriverRecord): Promise<void> {
  const canBeAvailable = driverRecord.isOnline && driverRecord.isVerified;

  await updateDoc(doc(firestore, COLLECTIONS.drivers, driverRecord.driverId), {
    currentRequestId: null,
    isOnline: canBeAvailable,
    isAvailable: canBeAvailable,
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
