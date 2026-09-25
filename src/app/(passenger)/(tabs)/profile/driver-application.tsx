import { Ionicons } from '@expo/vector-icons';
import { VehicleSelector } from '@/components/home/VehicleSelector';
import { LoadingScreen } from '@/components/LoadingScreen';
import { DocumentImageField } from '@/components/profile/DocumentImageField';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader, useScreenBack } from '@/components/ui/ScreenHeader';
import { TextInputField } from '@/components/ui/TextInputField';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useDriverApplication } from '@/hooks/useDriverApplication';
import {
  ApplicationDocumentImage,
  DOCUMENT_LABELS,
  DriverApplicationServiceError,
  splitFullName,
  submitDriverApplication,
} from '@/services/driverApplicationService';
import {
  DriverApplication,
  DriverApplicationDocumentType,
  DriverApplicationStatus,
  VehicleType,
} from '@/types';
import { validateMobileNumber } from '@/validations/auth';
import {
  normalizePersonName,
  normalizeVehiclePlate,
  validatePersonName,
  validateVehiclePlate,
} from '@/validations/driverApplication';
import { router } from 'expo-router';
import { ReactNode, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STEPS = ['Personal', 'Vehicle', 'Documents', 'Review'] as const;
type Step = 0 | 1 | 2 | 3;
type DocumentState = Record<DriverApplicationDocumentType, ApplicationDocumentImage | null>;

const STATUS_LABELS: Record<DriverApplicationStatus, string> = {
  pending: 'Pending Verification',
  approved: 'Approved',
  rejected: 'Rejected',
};

const DOCUMENT_DESCRIPTIONS: Record<DriverApplicationDocumentType, string> = {
  orCr: 'Official Receipt and Certificate of Registration of the vehicle you will use. The vehicle must be registered.',
  ltoLicense: "Your valid driver's license issued and verified by the LTO.",
};

const DOCUMENT_TYPES: DriverApplicationDocumentType[] = ['orCr', 'ltoLicense'];

function formatVehicleType(vehicleType: VehicleType | null): string {
  return vehicleType ? vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1) : '—';
}

function formatDate(value: Date | null): string {
  if (!value) return '—';
  return value.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function documentUri(image: ApplicationDocumentImage): string {
  return image.kind === 'local' ? image.uri : image.document.downloadUrl;
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, last ? styles.rowLast : null]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function ReviewSection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.reviewHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {onEdit ? (
          <Pressable accessibilityRole="button" onPress={onEdit} hitSlop={8}>
            <Text style={styles.editLink}>Edit</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function CheckItem({ label, done }: { label: string; done: boolean }) {
  return (
    <View style={styles.checkItem}>
      <Ionicons
        name={done ? 'checkmark-circle' : 'alert-circle'}
        size={18}
        color={done ? colors.primary : colors.error}
      />
      <Text style={styles.checkLabel}>{label}</Text>
    </View>
  );
}

function DocumentThumbnail({ label, uri }: { label: string; uri: string | null }) {
  return (
    <View style={styles.thumbnailItem}>
      {uri ? (
        <Image source={{ uri }} style={styles.thumbnail} resizeMode="cover" />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailMissing]}>
          <Ionicons name="alert-circle-outline" size={22} color={colors.error} />
        </View>
      )}
      <Text style={styles.thumbnailLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

export default function DriverApplicationScreen() {
  const insets = useSafeAreaInsets();
  const goBack = useScreenBack();
  const { passenger, firebaseUser, hasDriverMode } = useAuth();
  const { application, loading, error: loadError } = useDriverApplication();

  // The application is tied to the signed-in Firebase account and its email.
  const email = firebaseUser?.email ?? passenger?.email ?? '';

  const [resubmitting, setResubmitting] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [names, setNames] = useState(() => splitFullName(passenger?.fullName ?? ''));
  const [nameErrors, setNameErrors] = useState<Record<string, string>>({});
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [plateError, setPlateError] = useState('');
  const [vehicleTypeError, setVehicleTypeError] = useState('');
  const [documents, setDocuments] = useState<DocumentState>({ orCr: null, ltoLicense: null });
  const [documentErrors, setDocumentErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!passenger) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Driver Application" onBack={goBack} />
        <ErrorBanner message="Profile unavailable." />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Driver Application" onBack={goBack} />
        <LoadingScreen />
      </View>
    );
  }

  const showForm = !application || (application.status === 'rejected' && resubmitting);

  if (!showForm && application) {
    return (
      <ApplicationStatusView
        application={application}
        driverModeReady={hasDriverMode}
        loadError={loadError}
        paddingBottom={insets.bottom + spacing.xl}
        onBack={goBack}
        onResubmit={() => {
          setNames({
            firstName: application.firstName,
            middleName: application.middleName ?? '',
            lastName: application.lastName,
          });
          setVehicleType(application.vehicleType);
          setVehiclePlate(application.vehiclePlate);
          // Previously uploaded images can be kept or replaced.
          setDocuments({
            orCr: application.documents.orCr
              ? { kind: 'uploaded', document: application.documents.orCr }
              : null,
            ltoLicense: application.documents.ltoLicense
              ? { kind: 'uploaded', document: application.documents.ltoLicense }
              : null,
          });
          setStep(0);
          setError('');
          setResubmitting(true);
        }}
      />
    );
  }

  const nameValidation = {
    firstName: validatePersonName(names.firstName, 'First name', true),
    middleName: validatePersonName(names.middleName, 'Middle name', false),
    lastName: validatePersonName(names.lastName, 'Last name', true),
  };
  const mobileValid = validateMobileNumber(passenger.mobileNumber) === null;
  const personalComplete =
    !nameValidation.firstName &&
    !nameValidation.middleName &&
    !nameValidation.lastName &&
    email.length > 0 &&
    mobileValid;
  const vehicleComplete = vehicleType !== null && validateVehiclePlate(vehiclePlate) === null;
  const documentsComplete = documents.orCr !== null && documents.ltoLicense !== null;
  const canSubmit = personalComplete && vehicleComplete && documentsComplete && !submitting;

  function handleHeaderBack() {
    if (submitting) return;
    if (step > 0) {
      setStep((step - 1) as Step);
      setError('');
    } else if (resubmitting) {
      setResubmitting(false);
    } else {
      goBack();
    }
  }

  function updateName(field: keyof typeof names, value: string) {
    setNames((current) => ({ ...current, [field]: value }));
    setNameErrors((current) => ({ ...current, [field]: '' }));
  }

  function handlePersonalNext() {
    const errors: Record<string, string> = {};
    for (const [field, message] of Object.entries(nameValidation)) {
      if (message) errors[field] = message;
    }
    setNameErrors(errors);
    if (Object.keys(errors).length > 0 || !email || !mobileValid) return;

    setNames({
      firstName: normalizePersonName(names.firstName),
      middleName: normalizePersonName(names.middleName),
      lastName: normalizePersonName(names.lastName),
    });
    setStep(1);
  }

  function handleVehicleNext() {
    const typeError = vehicleType ? '' : 'Please choose your vehicle type.';
    const plateValidation = validateVehiclePlate(vehiclePlate) ?? '';
    setVehicleTypeError(typeError);
    setPlateError(plateValidation);
    if (typeError || plateValidation) return;
    setVehiclePlate(normalizeVehiclePlate(vehiclePlate));
    setStep(2);
  }

  function handleDocumentsNext() {
    const errors: Record<string, string> = {};
    if (!documents.orCr) errors.orCr = 'The OR/CR image is required.';
    if (!documents.ltoLicense) errors.ltoLicense = "The driver's license image is required.";
    setDocumentErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setStep(3);
  }

  async function handleSubmit() {
    // Guard against repeated taps while documents upload.
    if (!passenger || !vehicleType || !canSubmit) return;

    setSubmitting(true);
    setError('');

    try {
      await submitDriverApplication(passenger, email, {
        ...names,
        vehicleType,
        vehiclePlate,
        documents,
      });
      // The live application listener switches this screen to the Pending status view.
      setResubmitting(false);
    } catch (err) {
      setError(
        err instanceof DriverApplicationServiceError
          ? err.message
          : 'Unable to submit your application. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={resubmitting ? 'Resubmit Application' : 'Driver Application'}
        onBack={handleHeaderBack}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepper}>
          {STEPS.map((label, index) => (
            <View key={label} style={styles.stepItem}>
              <View
                style={[
                  styles.stepDot,
                  index < step ? styles.stepDotDone : null,
                  index === step ? styles.stepDotActive : null,
                ]}
              >
                {index < step ? (
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                ) : (
                  <Text style={[styles.stepNumber, index === step ? styles.stepNumberActive : null]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text style={[styles.stepLabel, index === step ? styles.stepLabelActive : null]}>
                {label}
              </Text>
            </View>
          ))}
        </View>

        <ErrorBanner message={error} />

        {step === 0 ? (
          <>
            <Text style={styles.stepTitle}>Personal Information</Text>
            <Text style={styles.stepIntro}>
              Enter your name exactly as it appears on your driver&apos;s license.
            </Text>

            <TextInputField
              label="First Name *"
              value={names.firstName}
              onChangeText={(text) => updateName('firstName', text)}
              error={nameErrors.firstName}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="givenName"
              placeholder="Juan"
              maxLength={50}
            />
            <TextInputField
              label="Middle Name (optional)"
              value={names.middleName}
              onChangeText={(text) => updateName('middleName', text)}
              error={nameErrors.middleName}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="middleName"
              placeholder="Dela Cruz"
              maxLength={50}
            />
            <TextInputField
              label="Last Name *"
              value={names.lastName}
              onChangeText={(text) => updateName('lastName', text)}
              error={nameErrors.lastName}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="familyName"
              placeholder="Santos"
              maxLength={50}
            />

            <View style={styles.card}>
              <Row label="Email (your TriGo account)" value={email || '—'} />
              <Row label="Mobile number" value={passenger.mobileNumber || '—'} last />
            </View>
            <Text style={styles.accountNote}>
              Your application uses the email of the account you are signed in with. Only one
              driver application is allowed per account.
            </Text>

            {!mobileValid ? (
              <>
                <ErrorBanner message="Please add a valid mobile number in Edit Profile before applying." />
                <Button
                  title="Edit Profile"
                  variant="secondary"
                  onPress={() => router.push('/profile/edit')}
                />
                <View style={styles.spacer} />
              </>
            ) : null}

            <Button title="Next: Vehicle" disabled={!mobileValid} onPress={handlePersonalNext} />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={styles.stepTitle}>Vehicle Information</Text>
            <Text style={styles.stepIntro}>
              Tell us about the vehicle you will use for TriGo trips.
            </Text>
            <VehicleSelector
              selected={vehicleType}
              onSelect={(type) => {
                setVehicleType(type);
                setVehicleTypeError('');
              }}
            />
            {vehicleTypeError ? <Text style={styles.fieldError}>{vehicleTypeError}</Text> : null}
            <TextInputField
              label="Plate number"
              value={vehiclePlate}
              onChangeText={(text) => {
                setVehiclePlate(text);
                setPlateError('');
              }}
              error={plateError}
              autoCapitalize="characters"
              placeholder="e.g. 123 ABC"
              maxLength={12}
            />
            <Button title="Next: Documents" onPress={handleVehicleNext} />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.stepTitle}>Documents</Text>
            <Text style={styles.stepIntro}>
              Take a clear photo or choose an image from your device. Both documents are required.
            </Text>

            {DOCUMENT_TYPES.map((documentType) => (
              <DocumentImageField
                key={documentType}
                label={DOCUMENT_LABELS[documentType]}
                description={DOCUMENT_DESCRIPTIONS[documentType]}
                fileNamePrefix={documentType}
                value={documents[documentType]}
                error={documentErrors[documentType]}
                onChange={(image) => {
                  setDocuments((current) => ({ ...current, [documentType]: image }));
                  setDocumentErrors((current) => ({ ...current, [documentType]: '' }));
                }}
              />
            ))}

            <Button title="Next: Review" onPress={handleDocumentsNext} />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={styles.stepTitle}>Review Driver Application</Text>
            <Text style={styles.stepIntro}>Check your details before submitting.</Text>

            <ReviewSection title="Personal Information" onEdit={() => setStep(0)}>
              <CheckItem label={`First name: ${names.firstName || '—'}`} done={!nameValidation.firstName} />
              <CheckItem
                label={`Middle name: ${names.middleName || '(none)'}`}
                done={!nameValidation.middleName}
              />
              <CheckItem label={`Last name: ${names.lastName || '—'}`} done={!nameValidation.lastName} />
              <CheckItem label={`Email: ${email || '—'}`} done={email.length > 0} />
              <CheckItem label={`Mobile number: ${passenger.mobileNumber}`} done={mobileValid} />
            </ReviewSection>

            <ReviewSection title="Vehicle Information" onEdit={() => setStep(1)}>
              <CheckItem
                label={`Vehicle type: ${formatVehicleType(vehicleType)}`}
                done={vehicleType !== null}
              />
              <CheckItem
                label={`Plate number: ${vehiclePlate || '—'}`}
                done={validateVehiclePlate(vehiclePlate) === null}
              />
            </ReviewSection>

            <ReviewSection title="Documents" onEdit={() => setStep(2)}>
              <View style={styles.thumbnails}>
                {DOCUMENT_TYPES.map((documentType) => {
                  const image = documents[documentType];
                  return (
                    <DocumentThumbnail
                      key={documentType}
                      label={DOCUMENT_LABELS[documentType]}
                      uri={image ? documentUri(image) : null}
                    />
                  );
                })}
              </View>
              {!documentsComplete ? (
                <Text style={styles.fieldError}>Both documents are required before submitting.</Text>
              ) : null}
            </ReviewSection>

            <Text style={styles.disclaimer}>
              Submitting does not make you a verified driver. Your application stays pending until
              a TriGo administrator reviews and approves it.
            </Text>

            <Button
              title={
                submitting
                  ? 'Uploading documents…'
                  : resubmitting
                    ? 'Resubmit Application'
                    : 'Submit Application'
              }
              loading={submitting}
              disabled={!canSubmit}
              onPress={handleSubmit}
            />
            {submitting ? (
              <Text style={styles.uploadingNote}>
                Please keep the app open while your documents upload.
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

interface ApplicationStatusViewProps {
  application: DriverApplication;
  driverModeReady: boolean;
  loadError: string;
  paddingBottom: number;
  onBack: () => void;
  onResubmit: () => void;
}

function ApplicationStatusView({
  application,
  driverModeReady,
  loadError,
  paddingBottom,
  onBack,
  onResubmit,
}: ApplicationStatusViewProps) {
  const heading: Record<DriverApplicationStatus, string> = {
    pending: 'Application Submitted',
    approved: 'Application Approved',
    rejected: 'Application Status',
  };
  const statusMessage: Record<DriverApplicationStatus, string> = {
    pending:
      'Your TriGo Driver Application has been submitted and is waiting for verification.',
    approved: driverModeReady
      ? 'Your Driver application has been approved.'
      : 'Your Driver application has been approved. Your driver account is being set up by the TriGo administrator.',
    rejected: 'Your application was not approved.',
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Driver Application" onBack={onBack} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        <ErrorBanner message={loadError} />

        <Text style={styles.stepTitle}>{heading[application.status]}</Text>

        <View
          style={[
            styles.statusCard,
            application.status === 'rejected' ? styles.statusCardRejected : null,
            application.status === 'pending' ? styles.statusCardPending : null,
          ]}
        >
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusValue}>{STATUS_LABELS[application.status]}</Text>
          <Text style={styles.statusMessage}>{statusMessage[application.status]}</Text>
        </View>

        {application.status === 'rejected' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Reason</Text>
            <Text style={styles.remarks}>
              {application.adminRemarks ?? 'No reason was provided by the administrator.'}
            </Text>
          </View>
        ) : application.adminRemarks ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Administrator remarks</Text>
            <Text style={styles.remarks}>{application.adminRemarks}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Submitted details</Text>
          <Row label="First name" value={application.firstName || '—'} />
          <Row label="Middle name" value={application.middleName || '—'} />
          <Row label="Last name" value={application.lastName || '—'} />
          <Row label="Email" value={application.email || '—'} />
          <Row label="Mobile number" value={application.mobileNumber} />
          <Row label="Vehicle type" value={formatVehicleType(application.vehicleType)} />
          <Row label="Plate number" value={application.vehiclePlate} />
          <Row label="Submitted" value={formatDate(application.submittedAt)} />
          <Row label="Reviewed" value={formatDate(application.reviewedAt)} last />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Documents</Text>
          <View style={styles.thumbnails}>
            {DOCUMENT_TYPES.map((documentType) => (
              <DocumentThumbnail
                key={documentType}
                label={DOCUMENT_LABELS[documentType]}
                uri={application.documents[documentType]?.downloadUrl ?? null}
              />
            ))}
          </View>
        </View>

        {application.status === 'rejected' ? (
          <Button title="Review Application" onPress={onResubmit} />
        ) : null}

        {application.status === 'approved' && driverModeReady ? (
          <Button title="Open Driver Mode" onPress={() => router.replace('/driver/home')} />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  stepper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  stepDotDone: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  stepNumber: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textMuted,
  },
  stepNumberActive: {
    color: colors.primary,
  },
  stepLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  stepTitle: {
    ...typography.title,
    fontSize: 22,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  stepIntro: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  editLink: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  row: {
    paddingVertical: spacing.sm,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  rowValue: {
    ...typography.body,
    color: colors.text,
  },
  accountNote: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  checkLabel: {
    ...typography.caption,
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  thumbnails: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  thumbnailItem: {
    flex: 1,
  },
  thumbnail: {
    width: '100%',
    height: 96,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  thumbnailMissing: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.error,
  },
  thumbnailLabel: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  fieldError: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  disclaimer: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  uploadingNote: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  statusCard: {
    backgroundColor: colors.primaryLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statusCardPending: {
    borderLeftColor: colors.accent,
  },
  statusCardRejected: {
    backgroundColor: colors.errorBackground,
    borderLeftColor: colors.error,
  },
  statusLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statusValue: {
    ...typography.title,
    fontSize: 20,
    color: colors.primaryDark,
    marginVertical: 2,
  },
  statusMessage: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  remarks: {
    ...typography.body,
    fontSize: 15,
    color: colors.text,
    lineHeight: 21,
  },
  spacer: {
    height: spacing.sm,
  },
});
