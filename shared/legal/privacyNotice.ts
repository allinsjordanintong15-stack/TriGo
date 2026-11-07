// TriGo Privacy Notice. Based on docs/privacy/DATA_INVENTORY.md (what the code does), with
// fix A (a driver's location is cleared on going offline) and fix B (ride request
// notifications are private on the Android lock screen).
//
// Editing this text changes what users agreed to: raise LEGAL_VERSION in meta.ts and run
// `npm run legal:export`.

import { PRIVACY_CONTACT } from './meta.ts';
import type { LegalDocument } from './types.ts';

/** Minimum age for an account, passengers and drivers alike. */
const MIN_AGE = 18;
/** Where Cloud Firestore keeps TriGo's data (Firebase project trigo-2eaf6, location nam5). */
const FIRESTORE_REGION = 'the United States (Google Cloud multi-region nam5)';

export const PRIVACY_NOTICE: LegalDocument = {
  id: 'privacy-notice',
  title: 'TriGo Privacy Notice',
  summary: [
    'TriGo connects passengers with tricycle and motorcycle drivers in Trinidad, Bohol. To do that we need your name, mobile number, email, trip details and, at certain moments, your location.',
    'Your mobile number is shared only with the other person on an active trip. A driver\'s location is shared only while the driver is online.',
    'We do not sell your data, we do not use advertising or analytics tools, and we never track your location in the background.',
    `Your data is stored and processed outside the Philippines, by Google in ${FIRESTORE_REGION}, on our behalf.`,
    `Questions or requests: ${PRIVACY_CONTACT.name}, ${PRIVACY_CONTACT.email}.`,
  ],
  sections: [
    {
      id: 'who-we-are',
      heading: '1. Who we are',
      blocks: [
        {
          kind: 'paragraph',
          text: `TriGo is run by ${PRIVACY_CONTACT.name}, the TriGo project team. We decide how the personal data described here is used, and we are responsible for it under the Data Privacy Act of 2012 (Republic Act No. 10173).`,
        },
        {
          kind: 'paragraph',
          text: `Contact for anything about your data: ${PRIVACY_CONTACT.name}, ${PRIVACY_CONTACT.email}.`,
        },
        {
          kind: 'paragraph',
          text: 'This notice covers the TriGo mobile app (for passengers and drivers) and the TriGo admin website used by the TriGo team.',
        },
      ],
    },
    {
      id: 'what-we-collect',
      heading: '2. What we collect',
      blocks: [
        { kind: 'paragraph', text: 'Everyone with an account:' },
        {
          kind: 'list',
          items: [
            'Your full name, email address, mobile number and role (passenger or driver).',
            'Your password, which is stored by Firebase Authentication in a protected (hashed) form. We cannot see it.',
            'When your account was created and last changed, and when you accepted this notice and the Terms of Use.',
          ],
        },
        { kind: 'paragraph', text: 'Trips:' },
        {
          kind: 'list',
          items: [
            'Pickup and destination (map position and place name), the barangays they are in, the road distance, the fare and how it was calculated.',
            'The payment method you chose (cash or GCash). TriGo does not handle the payment itself.',
            'The times a trip was requested, accepted, started, completed or cancelled, who cancelled it and the reason given.',
            'Ratings and comments you give, and problem reports (complaints) you send, including what you write in them.',
          ],
        },
        { kind: 'paragraph', text: 'Drivers and driver applicants, in addition:' },
        {
          kind: 'list',
          items: [
            'Your first, middle and last name, vehicle type, plate number, brand, model and color.',
            'Photos of your OR/CR and driver\'s license, once document uploads are enabled.',
            'The status of your application and the remarks of the TriGo team.',
            'Your online and available status, your location when you go online (see section 4), your rating and how many passengers you accepted today.',
            'Commission records: commission per completed trip, balances, payment periods, and the amount and GCash reference number of each commission payment you report.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'We do not ask for your date of birth, government ID numbers (other than what appears on driver documents), contacts list or photos from your phone other than the ones you choose.',
        },
      ],
    },
    {
      id: 'how-we-use-it',
      heading: '3. Why we use it',
      blocks: [
        {
          kind: 'list',
          items: [
            'To create and secure your account and let you sign in.',
            'To book trips: calculate the fare, show requests to suitable drivers, match a driver, and let the passenger and the driver contact each other during the trip.',
            'To check driver applications and keep driver details (name, plate and vehicle) correct, so passengers know who is coming.',
            'To record commission owed by drivers, check commission payments and apply the daily acceptance limit.',
            'To handle complaints and safety reports, and to keep trip records in case of disputes.',
            'To produce totals and reports for running TriGo (counts and sums, not profiles of individual users).',
          ],
        },
        {
          kind: 'paragraph',
          text: 'We use your data because it is needed to provide the service you signed up for (the Terms of Use), because you agreed to this notice, and, for trip and commission records, because we need to keep accurate records.',
        },
      ],
    },
    {
      id: 'location',
      heading: '4. Location',
      blocks: [
        {
          kind: 'list',
          items: [
            'Passengers: the app uses your location while you have it open, to place the pickup point on the map. Only the pickup and destination you confirm are saved with the trip.',
            'Drivers: when you go online, the app saves your position once, so passengers and the system can find nearby drivers. It is not updated continuously while you drive.',
            'When a driver goes offline, the saved position is deleted. Going online again requires a new position.',
            'TriGo never uses your location in the background and never asks for background location permission.',
          ],
        },
      ],
    },
    {
      id: 'who-sees-it',
      heading: '5. Who can see your data',
      blocks: [
        {
          kind: 'list',
          items: [
            'You can see your own profile, trips, ratings you gave, complaints you sent and, as a driver, your application and commission records.',
            'Your passenger or driver on an active trip (accepted, driver arrived, or in progress) can see your name and mobile number so you can call each other. This stops when the trip is completed or cancelled.',
            'Verified drivers can see open trip requests for their vehicle type: pickup, destination and fare, but not the passenger\'s name or number.',
            'A verified driver\'s record (name, plate, vehicle details, rating, online status, today\'s accepted count, verification details recorded by the TriGo team and, while online, location) can be read by signed-in TriGo users. The app shows passengers only the name, plate and vehicle of the driver assigned to them, and uses online drivers\' locations to find drivers for out-of-area trips.',
            'The TriGo team (admins) can see all accounts, trips, driver applications, driver records, complaints and commission records, to run the service and handle problems.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'We do not sell or rent your personal data, and we do not share it with advertisers.',
        },
      ],
    },
    {
      id: 'notifications',
      heading: '6. Notifications on drivers\' phones',
      blocks: [
        {
          kind: 'list',
          items: [
            'When the driver app is in the background, it can show a notification for a new ride request with the fare, the pickup and destination place names and the distance to the pickup.',
            'On Android these notifications are private: the lock screen shows only Android\'s own message that the contents are hidden. The details appear after the phone is unlocked. On iPhone, what the lock screen shows follows your iPhone\'s notification preview setting.',
            'The notifications are created on the phone itself. No server sends them, and no notification token is created or shared.',
          ],
        },
      ],
    },
    {
      id: 'service-providers',
      heading: '7. Services we use',
      blocks: [
        {
          kind: 'list',
          items: [
            `Google Firebase (Authentication, Cloud Firestore and Hosting) stores your account and the data in section 2, and keeps technical logs such as IP addresses and device or browser details. TriGo's data is stored in ${FIRESTORE_REGION}.`,
            'OpenRouteService (HeiGIT, Germany) receives pickup and destination map positions and the place names you type in the search, to find places, road routes and distances. It does not receive your name or number.',
            'OpenFreeMap provides the map images and receives your phone\'s IP address and the area of the map being shown.',
            'Your phone\'s own map services (Google on Android, Apple on iPhone) may receive a map position or search text when OpenRouteService is not available.',
            'GCash: drivers pay commission and passengers may pay fares in the GCash app, outside TriGo. TriGo sends nothing to GCash; drivers type the GCash reference number into TriGo.',
          ],
        },
        {
          kind: 'paragraph',
          text: `Your personal data is stored and processed outside the Philippines. Google stores and processes it in ${FIRESTORE_REGION} as our processor: only on our instructions and only to provide the services above, not for its own purposes. The other services listed may also process data outside the Philippines, only for the purposes above.`,
        },
      ],
    },
    {
      id: 'permissions',
      heading: '8. Phone permissions',
      blocks: [
        {
          kind: 'list',
          items: [
            'Location (only while the app is in use): see section 4.',
            'Notifications: ride request notifications for drivers. You can say no and still use the app.',
            'Vibration: the alert for a new ride request.',
            'Camera and photos: for driver document photos once uploads are enabled. TriGo uses only the photos you choose.',
            'Phone calls: the Call buttons open your phone\'s dialer. TriGo does not place or record calls.',
          ],
        },
      ],
    },
    {
      id: 'on-your-phone',
      heading: '9. What is kept on your phone',
      blocks: [
        {
          kind: 'paragraph',
          text: 'The app keeps your sign-in session so you stay signed in, and, for drivers, the list of requests you declined or that were hidden and whether the notification explanation was shown. Signing out ends the session. There are no advertising or analytics tools in the app.',
        },
      ],
    },
    {
      id: 'retention',
      heading: '10. How long we keep it',
      blocks: [
        {
          kind: 'list',
          items: [
            'Your account and profile: until you ask us to delete your account.',
            'Trips, commission and payment records: kept after an account is deleted, for accurate records, but without your name, mobile number or vehicle details.',
            'Driver applications and complaints: as long as needed to review them and to handle any follow-up or dispute.',
          ],
        },
      ],
    },
    {
      id: 'deletion',
      heading: '11. Deleting your account',
      blocks: [
        {
          kind: 'paragraph',
          text: `You can ask us to delete your account in the app (Profile → Privacy Policy & Terms → Request account deletion) or by email to ${PRIVACY_CONTACT.email}. When we do it:`,
        },
        {
          kind: 'list',
          items: [
            'Your name, mobile number and other personal details are removed from your profile and contact details.',
            'For drivers, your name, plate and vehicle details are removed from your driver record and driver application, and you are taken offline and can no longer accept trips.',
            'Trip, commission and payment records stay, without your personal details (see section 10).',
            'Your sign-in account is deleted by the TriGo team, after which you can no longer sign in.',
          ],
        },
      ],
    },
    {
      id: 'your-rights',
      heading: '12. Your rights',
      blocks: [
        { kind: 'paragraph', text: 'Under the Data Privacy Act of 2012 you have the right to:' },
        {
          kind: 'list',
          items: [
            'be informed about how your data is used (this notice);',
            'access the personal data we hold about you;',
            'have wrong or incomplete data corrected;',
            'object to the use of your data, or withdraw your agreement;',
            'have your data deleted or blocked;',
            'get a copy of your data in a usable format;',
            'be compensated for damage caused by wrong or unlawful use of your data;',
            'file a complaint with the National Privacy Commission (privacy.gov.ph).',
          ],
        },
        {
          kind: 'paragraph',
          text: `To use any of these rights, email ${PRIVACY_CONTACT.email}. Passengers can also correct their name and mobile number in the app. Withdrawing your agreement or deleting your account means you can no longer use TriGo.`,
        },
      ],
    },
    {
      id: 'security',
      heading: '13. Security',
      blocks: [
        {
          kind: 'paragraph',
          text: 'All data is sent over encrypted connections. Access is limited by sign-in and by security rules that check every read and write, so users see only what is described in section 5. No system is perfectly secure; if we learn of a breach that affects you, we will tell you and the National Privacy Commission as the law requires.',
        },
      ],
    },
    {
      id: 'age',
      heading: '14. Age',
      blocks: [
        {
          kind: 'paragraph',
          text: `You must be at least ${MIN_AGE} years old to have a TriGo account, as a passenger or as a driver. Drivers must also hold a valid driver's license.`,
        },
        {
          kind: 'paragraph',
          text: `Children and teenagers under ${MIN_AGE} may ride only when an adult books the trip with the adult's own account. The adult is responsible for them during the trip. Do not create an account for anyone under ${MIN_AGE}. We do not knowingly collect personal data from anyone under ${MIN_AGE}.`,
        },
      ],
    },
    {
      id: 'changes',
      heading: '15. Changes to this notice',
      blocks: [
        {
          kind: 'paragraph',
          text: 'When this notice changes, it gets a new version number and effective date, and the app asks you to read and accept it again before you continue.',
        },
      ],
    },
  ],
};
