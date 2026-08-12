export function formatPhilippinePeso(amount: number): string {
  return `₱${amount.toFixed(2)}`;
}

export function calculateFareDifference(standardEstimatedFare: number, agreedFare: number) {
  const difference = Math.round((agreedFare - standardEstimatedFare) * 100) / 100;
  const differencePercentage =
    standardEstimatedFare > 0
      ? Math.round((difference / standardEstimatedFare) * 1000) / 10
      : 0;

  return { difference, differencePercentage };
}
