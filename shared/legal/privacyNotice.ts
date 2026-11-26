// TriGo Privacy Notice. Based on docs/privacy/DATA_INVENTORY.md (what the code does), with
// fix A (a driver's location is cleared on going offline) and fix B (ride request
// notifications are private on the Android lock screen). Version 1.1 adds application photos
// in Firestore, inbox messages and announcements, complaints, warnings and suspensions.
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
            'Complaints about you: a problem report can name the other person on the trip (see section 6).',
          ],
        },
        { kind: 'paragraph', text: 'Drivers and driver applicants, in addition:' },
        {
          kind: 'list',
          items: [
            'Your first, middle and last name, vehicle type, plate number, brand, model and color.',
            'Photos of your OR/CR and driver\'s license, which you take or choose in the app. They are stored as compressed images (JPEG) in Cloud Firestore, with their file size and dimensions.',
            'The status of your application and the remarks of the TriGo team.',
            'Your online and available status, your location when you go online (see section 4), your rating and how many passengers you accepted today.',
            'Commission records: commission per completed trip, balances, payment periods, and the amount and GCash reference number of each commission payment you report.',
            'Suspensions: when a suspension starts and ends, the reason and which administrator set or lifted it (see section 6).',
          ],
        },
        { kind: 'paragraph', text: 'Messages and records from TriGo:' },
        {
          kind: 'list',
          items: [
            'Messages from TriGo in your inbox (application decisions, commission payment decisions, report updates, warnings, suspensions and account deletion decisions), with the reason given and when you read them.',
            'Which announcements you have read.',
            'Warnings: the reason, the date, the trip and complaint it relates to (if any), which administrator gave it, and when you acknowledged it.',
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
            'To handle complaints and safety reports, give warnings, suspend drivers who break the Terms of Use, and keep trip records in case of disputes.',
            'To tell you about decisions on your account, application, payments and reports, and to send announcements to all users, to passengers or to drivers.',
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
            'Driver application photos (OR/CR and driver\'s license) can be seen only by the applicant and the TriGo team. They are never shown to passengers or other drivers.',
            'Your inbox messages and warnings can be seen only by you and the TriGo team.',
            'A verified driver\'s record (name, plate, vehicle details, rating, online status, today\'s accepted count, verification and suspension details recorded by the TriGo team and, while online, location) can be read by signed-in TriGo users. The app shows passengers only the name, plate and vehicle of the driver assigned to them, and uses online drivers\' locations to find drivers for out-of-area trips.',
            'The TriGo team (admins) can see all accounts, trips, driver applications and their photos, driver records, complaints, warnings, inbox messages and commission records, to run the service and handle problems.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'We do not sell or rent your personal data, and we do not share it with advertisers.',
        },
      ],
    },
    {
      id: 'complaints-warnings-suspensions',
      heading: '6. Complaints, warnings and suspensions',
      blocks: [
        {
          kind: 'list',
          items: [
            'A problem report (complaint) is about one trip and can name the other person on that trip (the driver or the passenger). The TriGo team reviews every report and may take no action, give a warning or, for a driver, suspend the account.',
            'The person who sent the report gets a message that it was reviewed. The app does not show them the TriGo team\'s internal notes or what action was taken.',
            'The person named in a report does not see the report or the reporter\'s message. If they are warned, they see the warning and its reason.',
            'A warning records the reason, the date, the trip and complaint it relates to (if any) and which administrator gave it. It stays in your inbox until you acknowledge it. The TriGo team can withdraw it.',
            'A driver suspension records when it starts, until when (or until lifted), the reason and which administrator set it. While suspended, a driver cannot accept new trips; a trip already in progress can be finished. The driver gets a message with the reason, and another when the suspension is lifted.',
            `To ask about or contest a warning or a suspension, email ${PRIVACY_CONTACT.email} with your name and the date of the message. The TriGo team will review it and can withdraw the warning or lift the suspension.`,
          ],
        },
      ],
    },
    {
      id: 'notifications',
      heading: '7. Notifications and messages',
      blocks: [
        {
          kind: 'list',
          items: [
            'Ride request alerts (drivers): while the driver app is running, also in the background, it can show a notification for a new ride request with the fare, the pickup and destination place names and the distance to the pickup.',
            'Messages from TriGo (everyone): application decisions, commission payment decisions, report updates, warnings, suspensions and account deletion decisions appear in the inbox in the app.',
            'Announcements: notices from the TriGo team to all users, to passengers or to drivers, also shown in the inbox.',
            'While the app is running, a new inbox message or announcement can also show a phone notification with its title only. The details are shown in the app.',
            'When you read a message or an announcement, or acknowledge a warning, this is stored in Cloud Firestore so the inbox can show what is new.',
            'On Android these notifications are private: the lock screen shows only Android\'s own message that the contents are hidden. The details appear after the phone is unlocked. On iPhone, what the lock screen shows follows your iPhone\'s notification preview setting.',
            'The notifications are created on the phone itself. No server sends them, and no notification token is created or shared. Once your phone stops the app, no notifications are shown until you open it again.',
          ],
        },
      ],
    },
    {
      id: 'service-providers',
      heading: '8. Services we use',
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
      heading: '9. Phone permissions',
      blocks: [
        {
          kind: 'list',
          items: [
            'Location (only while the app is in use): see section 4.',
            'Notifications: ride request alerts for drivers and inbox notifications for everyone (section 7). You can say no and still use the app; messages stay in the inbox.',
            'Vibration: the alert for a new ride request.',
            'Camera and photos: to take or choose the photos of your OR/CR and driver\'s license when you apply as a driver. TriGo uses only the photos you take or choose.',
            'Phone calls: the Call buttons open your phone\'s dialer. TriGo does not place or record calls.',
          ],
        },
      ],
    },
    {
      id: 'on-your-phone',
      heading: '10. What is kept on your phone',
      blocks: [
        {
          kind: 'paragraph',
          text: 'The app keeps your sign-in session so you stay signed in, and, for drivers, the list of requests you declined or that were hidden and whether the notification explanation was shown. Signing out ends the session. There are no advertising or analytics tools in the app.',
        },
      ],
    },
    {
      id: 'retention',
      heading: '11. How long we keep it',
      blocks: [
        {
          kind: 'list',
          items: [
            'Your account and profile: until you ask us to delete your account.',
            'Trip, commission and payment records: kept after an account is deleted, for accurate financial records and reports, but without your name, mobile number or vehicle details.',
            'Driver application photos: while your application or driver account is active. They are deleted when your account is deleted.',
            'Driver applications and complaints: as long as needed to review them and to handle any follow-up or dispute.',
            'Inbox messages and warnings: while your account exists. When your account is deleted, the record stays but its reason and message text are removed.',
          ],
        },
      ],
    },
    {
      id: 'deletion',
      heading: '12. Deleting your account',
      blocks: [
        {
          kind: 'paragraph',
          text: `You can ask us to delete your account in the app (Profile → Privacy Policy & Terms → Request account deletion) or by email to ${PRIVACY_CONTACT.email}. When we do it:`,
        },
        {
          kind: 'list',
          items: [
            'Your name, mobile number and other personal details are removed from your profile and contact details.',
            'For drivers, your name, plate and vehicle details are removed from your driver record and driver application, your document photos are deleted, and you are taken offline and can no longer accept trips.',
            'The reasons and message text of your warnings and inbox messages are removed.',
            'Trip, commission and payment records stay, without your personal details, for financial records and reports (see section 11).',
            'Your sign-in account is deleted by the TriGo team, after which you can no longer sign in.',
          ],
        },
      ],
    },
    {
      id: 'your-rights',
      heading: '13. Your rights',
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
      heading: '14. Security',
      blocks: [
        {
          kind: 'paragraph',
          text: 'All data is sent over encrypted connections. Access is limited by sign-in and by security rules that check every read and write, so users see only what is described in sections 5 and 6. No system is perfectly secure; if we learn of a breach that affects you, we will tell you and the National Privacy Commission as the law requires.',
        },
      ],
    },
    {
      id: 'age',
      heading: '15. Age',
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
      heading: '16. Changes to this notice',
      blocks: [
        {
          kind: 'paragraph',
          text: 'When this notice changes, it gets a new version number and effective date, and the app asks you to read and accept it again before you continue.',
        },
      ],
    },
  ],
};
