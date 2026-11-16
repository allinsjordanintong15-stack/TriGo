import { CopyButton } from './TechnicalDetails';

/** A phone number to tap (opens the phone app on mobile) or copy. */
export function PhoneNumber({ phone }: { phone: string }) {
  return (
    <span className="phone-number">
      <a className="btn-link mono" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
        {phone}
      </a>{' '}
      <CopyButton text={phone} label="phone number" />
    </span>
  );
}
