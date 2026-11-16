import { useState } from 'react';

import { initials } from '../drivers/driverTable';

/**
 * A round profile photo, or the person's initials on light green when there is no photo or
 * it fails to load (no Firebase Storage needed). Decorative: the name is shown next to it.
 */
export function Avatar({ name, imageUrl, size = 40 }: { name: string; imageUrl: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (imageUrl && !failed) {
    return (
      <img
        className="avatar"
        src={imageUrl}
        alt=""
        style={style}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span className="avatar avatar-initials" style={style} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
