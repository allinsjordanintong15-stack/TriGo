// TriGo Terms of Use. Describes how the app works today (fares, expiry, cancellations,
// commission, daily limit, revocation); see docs/DECISIONS.md.
//
// Editing this text changes what users agreed to: raise LEGAL_VERSION in meta.ts and run
// `npm run legal:export`.

import { PRIVACY_CONTACT } from './meta.ts';
import type { LegalDocument } from './types.ts';

/** Minimum age for an account, passengers and drivers alike (same as the Privacy Notice). */
const MIN_AGE = 18;

export const TERMS: LegalDocument = {
  id: 'terms',
  title: 'TriGo Terms of Use',
  summary: [
    'TriGo is a booking app that connects passengers with tricycle and motorcycle drivers in Trinidad, Bohol. Rides are given by the drivers, not by TriGo.',
    'The fare shown when you confirm a booking is the fare. Passengers pay the driver directly, in cash or by GCash.',
    'Drivers are verified by the TriGo team, pay TriGo a commission on completed trips, and can be suspended or removed for breaking these terms.',
  ],
  sections: [
    {
      id: 'agreement',
      heading: '1. Agreeing to these terms',
      blocks: [
        {
          kind: 'paragraph',
          text: `These terms apply to the TriGo mobile app and are offered by ${PRIVACY_CONTACT.name}. By creating an account or continuing to use TriGo after accepting them, you agree to these terms and to the TriGo Privacy Notice. If you do not agree, do not use TriGo.`,
        },
      ],
    },
    {
      id: 'accounts',
      heading: '2. Your account',
      blocks: [
        {
          kind: 'list',
          items: [
            `You must be at least ${MIN_AGE} years old to have an account, as a passenger or as a driver.`,
            `Someone under ${MIN_AGE} may ride only when an adult books the trip with the adult's own account. The adult is responsible for them during the trip.`,
            'Give your real name and a mobile number where you can be reached, and keep them up to date.',
            'Keep your password to yourself. You are responsible for what is done with your account.',
            'One account per person. Do not use someone else\'s account.',
          ],
        },
      ],
    },
    {
      id: 'service',
      heading: '3. What TriGo does',
      blocks: [
        {
          kind: 'list',
          items: [
            'TriGo shows a passenger\'s trip request to verified drivers and lets a driver accept it. The ride itself is given by the driver.',
            'TriGo does not handle money for trips. Fares are paid by the passenger directly to the driver.',
            'The main service area is the Municipality of Trinidad, Bohol. Trips with a pickup or destination outside Trinidad are out-of-area trips (section 5).',
            'TriGo needs an internet connection and a road route between pickup and destination. If no route is found, the trip cannot be booked.',
          ],
        },
      ],
    },
    {
      id: 'fares',
      heading: '4. Fares and payment',
      blocks: [
        {
          kind: 'list',
          items: [
            'The fare is set by the TriGo team and shown before you confirm. The fare shown at confirmation is the fare you pay; it is not an estimate.',
            'A trip between Poblacion and a barangay of Trinidad, in either direction, is charged that barangay\'s set fare when one applies. Other trips are charged per kilometer of road distance.',
            'If the fare changes before you confirm, you are shown the new fare and must confirm again.',
            'Pay the driver in cash or by GCash, as chosen in the booking. Drivers must not ask for more than the fare shown.',
          ],
        },
      ],
    },
    {
      id: 'bookings',
      heading: '5. Bookings, out-of-area trips and cancellations',
      blocks: [
        {
          kind: 'list',
          items: [
            'A booking that no driver accepts expires after a few minutes (set by the TriGo team). You can then try again.',
            'Out-of-area trips are offered to one driver at a time. The fare is the per-kilometer fare and is final; drivers do not set their own price. The passenger confirms the driver or chooses another one.',
            'The passenger or the driver can cancel a trip in the app before it starts, and may give a reason. Once the trip has started it can no longer be cancelled in the app.',
            'Do not make bookings you do not intend to take, and do not accept trips you do not intend to drive.',
          ],
        },
      ],
    },
    {
      id: 'drivers',
      heading: '6. Drivers',
      blocks: [
        {
          kind: 'list',
          items: [
            'To drive with TriGo you apply in the app and are verified by the TriGo team. Your vehicle details, plate, OR/CR and driver\'s license must be real, valid and your own to use.',
            'Follow traffic laws and local rules for tricycles and motorcycles, and keep your vehicle safe.',
            'Go online only when you are ready to accept trips. Your location is saved when you go online and deleted when you go offline (see the Privacy Notice).',
            'There is a daily limit on how many passengers you can accept, set by the TriGo team. It resets at 12:00 AM Philippine time. A slot is given back if the passenger cancels before the trip starts.',
            'TriGo charges a commission, a percentage of the fare set by the TriGo team, on every completed trip. The total for each payment period is due at the end of the period.',
            'Pay commission by GCash to TriGo\'s GCash account shown in the app, and enter the GCash reference number. The TriGo team checks each payment and confirms or rejects it. Each reference number can be used once.',
            'If commission is not paid after the due date you get a warning; after the grace period you cannot accept trips until the overdue amount is confirmed paid.',
            'The TriGo team can revoke a driver\'s access for breaking these terms, for false documents or details, or for safety reasons. A trip already in progress can still be finished.',
          ],
        },
      ],
    },
    {
      id: 'conduct',
      heading: '7. How everyone must behave',
      blocks: [
        {
          kind: 'list',
          items: [
            'Treat passengers, drivers and the TriGo team with respect. No harassment, threats, discrimination or violence.',
            'Use the other person\'s mobile number only for the trip. Do not save it, share it or contact them after the trip.',
            'Do not give false information, misuse the fare or payment features, or try to get around the app\'s rules.',
            'Do not try to access data or accounts that are not yours, or disturb how the app works.',
          ],
        },
      ],
    },
    {
      id: 'complaints',
      heading: '8. Problems, complaints and safety',
      blocks: [
        {
          kind: 'list',
          items: [
            'You can report a problem with a trip in the app (Report a problem on the trip). The TriGo team reviews every report.',
            'In an emergency, contact the police or other local emergency services first. TriGo is not an emergency service.',
            'The support numbers in the app can be called for help with TriGo.',
          ],
        },
      ],
    },
    {
      id: 'availability',
      heading: '9. Availability',
      blocks: [
        {
          kind: 'list',
          items: [
            'TriGo may be unavailable at times, for example during maintenance or when the internet or a service it relies on is down.',
            'Ride request notifications arrive only while the driver app is running. Phones may stop apps in the background, so drivers should keep the app open while online.',
            'Maps, places, routes and distances come from outside services and may not always be exact.',
          ],
        },
      ],
    },
    {
      id: 'ending',
      heading: '10. Ending your use of TriGo',
      blocks: [
        {
          kind: 'list',
          items: [
            'You can stop using TriGo at any time and ask for your account to be deleted (see the Privacy Notice).',
            'The TriGo team can suspend or close an account that breaks these terms.',
          ],
        },
      ],
    },
    {
      id: 'responsibility',
      heading: '11. Responsibility',
      blocks: [
        {
          kind: 'paragraph',
          text: 'The driver is responsible for the ride and for driving safely. As far as the law allows, TriGo is not responsible for losses caused by how a passenger or driver behaves, or by the service being unavailable. Nothing in these terms removes rights you have under Philippine law.',
        },
      ],
    },
    {
      id: 'law',
      heading: '12. Law',
      blocks: [
        {
          kind: 'paragraph',
          text: 'These terms are governed by the laws of the Republic of the Philippines.',
        },
      ],
    },
    {
      id: 'changes',
      heading: '13. Changes and contact',
      blocks: [
        {
          kind: 'paragraph',
          text: `When these terms change, they get a new version number and effective date, and the app asks you to accept them again before you continue. Questions: ${PRIVACY_CONTACT.name}, ${PRIVACY_CONTACT.email}.`,
        },
      ],
    },
  ],
};
