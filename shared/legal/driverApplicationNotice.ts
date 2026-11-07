// The short privacy notice shown above Submit on the driver application. It summarises the
// Privacy Notice (sections 2, 5 and the driver parts) and belongs to the same version: the
// application stores privacyNoticeVersion = LEGAL_VERSION when the applicant ticks
// "I've read this". Editing it means a new LEGAL_VERSION, like the Privacy Notice itself.

export interface DriverApplicationNotice {
  title: string;
  points: readonly { heading: string; text: string }[];
  acknowledgement: string;
}

export const DRIVER_APPLICATION_NOTICE: DriverApplicationNotice = {
  title: 'Your data in this application',
  points: [
    {
      heading: 'What we collect',
      text: "Your name, email and mobile number, your vehicle type, plate number, brand, model and color, and photos of your OR/CR and driver's license.",
    },
    {
      heading: 'Who reviews it',
      text: 'The TriGo team (administrators) checks your application and documents. Only you and the TriGo team can see them.',
    },
    {
      heading: 'If you are approved',
      text: 'Your name, plate number and vehicle (type, brand, model and color) are shown to passengers, and your mobile number is shared with the passenger only during an active trip.',
    },
  ],
  acknowledgement: "I've read this",
};
