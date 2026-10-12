import { useState } from 'react';
import {
  deviceIds,
  deviceLabels,
  browserLabels,
  browsersFor,
  type ClientProfile,
  type Device,
} from '../../api/src/client-profiles';
export function ClientProfileFields({
  initial = { device: 'desktop', browser: 'chrome' },
}: {
  initial?: ClientProfile;
}) {
  const [profile, setProfile] = useState(initial);
  return (
    <>
      <label>
        Device
        <select
          name="device"
          value={profile.device}
          onChange={(event) => {
            const device = event.target.value as Device;
            const options = browsersFor(device);
            setProfile({
              device,
              browser: options.includes(profile.browser)
                ? profile.browser
                : options[0]!,
            });
          }}
        >
          {deviceIds.map((id) => (
            <option key={id} value={id}>
              {deviceLabels[id]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Browser
        <select
          name="browser"
          value={profile.browser}
          onChange={(event) =>
            setProfile({
              ...profile,
              browser: event.target.value as ClientProfile['browser'],
            })
          }
        >
          {browsersFor(profile.device).map((id) => (
            <option key={id} value={id}>
              {browserLabels[id]}
            </option>
          ))}
        </select>
      </label>
      <p className="small-note" style={{ gridColumn: '1 / -1' }}>
        Used for automated sessions. Manual logins use your actual device and
        browser. Clarity determines how recordings are classified and may filter
        automation.
      </p>
    </>
  );
}
