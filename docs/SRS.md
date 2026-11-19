| Software Requirement Specification  Trigo: Transport Booking and Management Mobile Application for Trinidad, Bohol |  |
| --- | --- |

Software Requirement Specification

for

Trigo: Transport Booking and Management Mobile Application for Trinidad, Bohol

Version 2.0

**Revision History**

| **Version** | **Date** | **Summary of Changes** | **Author** |
| --- | --- | --- | --- |
| 1.0 | ⟦To confirm: date of the original submission⟧ | Initial Software Requirements Specification. | TriGo Development Team |
| 2.0 | November 15, 2026 | Updated to describe the system as built: Administrator website, map and routing services (MapLibre, OpenFreeMap, OpenRouteService), fare model with administrator per-km rates and barangay tariffs, out-of-area requests at the per-km fare, commission with GCash payments confirmed by the Administrator, daily acceptance quota, booking expiry, passenger cancellation rules, driver rating, complaints with warnings and in-app inbox, Data Privacy Act consent and account deletion, security through Cloud Firestore Security Rules without Cloud Functions, data requirements, and known limitations. | TriGo Development Team |

**List of Figures**

	**  ****Figure No.**			**Description**					**Page**

	** **

**   **Figure 1.0 		    Passenger Registration Use Case				   20

  Figure 2.0 		    Passenger Login Use Case    					   20

  Figure 3.0		    Passenger Dashboard Use Case				   21 

  Figure 4.0     	    Passenger Profile Use Case 					   21

  Figure 5.0		    Driver Registration Use Case					   21

  Figure 6.0 		    Driver Login Use Case						   22

  Figure 7.0 		    Driver Dashboard Use Case					   22

  Figure 8.0 		    Driver Profile Use Case						   23

  Figure 9.0 		    Admin Login Use Case						   23

	  Figure 10.0              Passenger Registration and Login Prototype         	             24 

	  Figure 11.0              Passenger Dashboard View Prototype			   	    25

   Figure 12.0.             Booking Process Prototype				   	    26

Figure 13.0 		    Passenger Activity and Notifications View Prototype	    27

  Figure 14.0 	    Passenger Settings and Profile View Prototype	             27

  Figure 15.0 	    Driver Registration and Login Prototype			    29

  Figure 16.0 	    Driver Dashboard View Prototype				    30

  Figure 17.0 	             Trips View Prototype				            	    31

  Figure 18.0 	    Earnings Dashboard and Profile View Prototype		    31

  Figure 19.0 	    Vehicle Info and Driver Rating View Prototype	             32

  Figure 20.0 	    Admin Login Prototype				 		   32

  Figure 21.0 	    Admin Dashboard View Prototype				    33

  Figure 22.0 	    Passenger Management Prototype		            	    33

  Figure 23.0             Driver Management Prototype					    34

  Figure 24.0		   Vehicle Fleet Prototype						    34

  Figure 25.0		   Fare Management Prototype					    36

  

  

# List of Tables

**Table No.**				**Description**					**Page**

Table 1.0               	 Definition, Acronyms, and Abbreviations		   2

Table 2.0               	 Data Stored in Cloud Firestore		   ⟦page⟧

		# Overview

        This section provides a general description of the TriGo: Transport Booking and Management Mobile Application for Trinidad, Bohol. It introduces the purpose of the system, its main features, intended users, and the requirements that guide the development of the application.

	## Project Summary

		

		      TriGo: Transport Booking and Management Mobile Application for Trinidad, Bohol is a mobile application designed to make it easier and more convenient for passengers to book tricycle and motorcycle rides within the Municipality of Trinidad, Bohol.

		      

			 The application aims to improve the usual way of finding transportation, especially when passengers have to wait for a long time during busy hours or bad weather. It also helps address common problems such as unclear fares, difficulty communicating with drivers, and finding an available ride.

		      

			 With TriGo, passengers can request and book rides through the application, while registered and verified drivers can receive booking requests, manage their availability, and update the status of their rides. The system provides real-time booking status, a fixed fare shown before confirmation, a record of the payment method used (Cash or GCash), an in-app inbox for messages from TriGo, and ride and trip history.

		

		       The system also provides administrative management, reports, and system monitoring through a separate Administrator website. Administrators can manage passenger and driver accounts, verify driver applications, monitor bookings and system activities, handle complaints and warnings, and manage transportation-related settings such as fares, barangay tariffs, the daily acceptance quota, and commissions.

		       TriGo primarily supports transportation services within Trinidad, Bohol. Trips with a pickup or destination outside the municipality may also be accommodated as out-of-area requests when a driver is available and willing to accept the request. For such trips, the fare is the per-kilometre fare set by the Administrator, and it is final.

			 

		      The application is designed to be functional on both Android and iOS mobile devices. Overall, TriGo is designed to make the transportation booking process more organized, convenient, accessible, and transparent for passengers, drivers, and administrators in the local community.

		

	## Definition, Acronyms, and Abbreviations

| **Terms** | **Definition** |
| --- | --- |
| SRS | Software Requirements Specification – a document that describes the system requirements and expected functions |
| TriGo | Is a mobile application that helps users book transportation and travel to their desired destination within Trinidad, Bohol. |
| iOS | iPhone Operating System - is the core software that runs on Apple’s mobile devices like the iPhone. |
| GPS | Global Positioning System used to determine geographical location. |
| Firebase | A Google platform that provides backend services such as authentication, database, hosting, and cloud functions. TriGo uses Firebase Authentication, Cloud Firestore, and Firebase Hosting. |
| GCash | Is a Philippine mobile payments service owned by Globe Fintech Innovations, Inc. (doing business as Mynt), and operated by its wholly owned subsidiary, G-Xchange, Inc. |
| Prototype | This is an initial creation of the product that shows the basics of what a product looks like, what a product do and how it operates. |
| Cloud Firestore | The NoSQL cloud database of Firebase. Data is stored as documents grouped in collections. |
| Firestore Security Rules | Rules stored with Cloud Firestore that decide, for every read and write, whether the signed-in user may perform it and whether the data is valid. |
| Spark plan | The free Firebase plan used by TriGo. It does not include Cloud Functions or Firebase Storage. |
| Blaze plan | The pay-as-you-go Firebase plan required for Cloud Functions and Firebase Storage. |
| MapLibre | An open-source map display library used by the mobile application. |
| OpenFreeMap | A free map tile service, based on OpenStreetMap data, used for the map shown in the application. |
| OpenRouteService (ORS) | An online service used for road routes, road distances, and place search. |
| Out-of-area request | A ride request whose pickup or destination is outside Trinidad, Bohol. |
| Barangay tariff | A fixed fare, set by the Administrator per vehicle type, for a trip between Poblacion and a given barangay. |
| Per-kilometre (per-km) fare | A fare equal to the Administrator-set base fare plus the Administrator-set rate per kilometre of road distance, for each vehicle type. |
| Commission | A percentage of the final fare of each completed trip that the driver pays to TriGo. |
| Daily acceptance quota | The maximum number of passengers a driver may accept in one day (Manila time), set by the Administrator. |
| RA 10173 | Republic Act No. 10173, the Data Privacy Act of 2012 of the Philippines. |

		

		Table 1.0 Definition, Acronyms, and Abbreviations

	## References

		

		[1] International Organization for Standardization (ISO). (2018). ISO/IEC/IEEE 29148:2018 – Systems and software engineering — Life cycle processes — Requirements engineering.

		https://www.iso.org/standard/72089.html

		

		[2] Apple Inc. (2026). iOS – Apple Developer.

		https://developer.apple.com/ios/

		

		[3] U.S. Government. (2026). Global Positioning System (GPS).

		https://www.gps.gov/gps

		

		[4] Google. (2026). Firebase Documentation.

		https://firebase.google.com/docs/

		

		[5] GCash. (n.d.). GCash – Philippine mobile payments service. Wikipedia.

		[https://en.wikipedia.org/wiki/GCash](https://en.wikipedia.org/wiki/GCash?utm_source=chatgpt.com)

		

		[6] IBM. (2026). Enterprise Design Thinking Framework – Prototype Concepts.

		https://www.ibm.com/training/enterprise-design-thinking/framework

		

		[7] Republic of the Philippines. (2012). Republic Act No. 10173 – Data Privacy Act of 2012.

		https://privacy.gov.ph/data-privacy-act/

		

		[8] OpenRouteService. (n.d.). OpenRouteService API documentation.

		https://openrouteservice.org/dev/#/api-docs

		

		[9] MapLibre. (n.d.). MapLibre Native.

		https://maplibre.org/

		

		[10] OpenFreeMap. (n.d.). OpenFreeMap.

		https://openfreemap.org/

		

		[11] OCHA Humanitarian Data Exchange. (2025). Philippines – Subnational Administrative Boundaries (PSA/NAMRIA), version v03.

		⟦To confirm: exact HDX dataset URL⟧

		

		# Overall Description

        TriGo: Transport Booking and Management Mobile Application for Trinidad, Bohol is a mobile application designed to make it easier for passengers to find and book tricycle and motorcycle rides within the Municipality of Trinidad, Bohol. It provides a convenient platform for passengers to request transportation while allowing registered and verified drivers to receive booking requests, manage their availability, and manage their rides.

         This section describes the overall features and functions of the TriGo Mobile Application. It also identifies the intended users, operating environment, technologies, and general conditions and limitations that may affect the system. The information presented in this section provides a general description of the system and serves as a guide for defining the detailed functional and non-functional requirements of the application.

	## Product Perspective

      TriGo is a standalone mobile transportation booking and management application designed to connect passengers with registered and verified tricycle and motorcycle drivers primarily within the Municipality of Trinidad, Bohol. Instead of relying only on traditional methods of waiting or searching for available transportation, passengers can use the application to request a ride, set their pickup and destination on a map, view the fare before confirming, and monitor their booking status.

      Registered and verified drivers can receive passenger booking requests, accept or decline requests, manage their availability, update ride status, and view their completed ride history. When a trip is completed, the driver records whether the passenger paid in Cash or by GCash. TriGo does not process payments between passengers and drivers; it records the payment method and the final fare.

      The system includes an Administrator component, built as a separate web application (the Administrator website), for managing and monitoring the overall system. Administrators can manage passenger and driver accounts, verify driver applications, monitor bookings and system activities, handle complaints and warnings, generate reports, and manage transportation-related settings. These settings include per-kilometre fares, barangay tariffs, the daily acceptance quota, commission rates, booking expiry times, out-of-area settings, and support contacts.

       The mobile application is developed using React Native with Expo and TypeScript. The Administrator website is developed using React with Vite and TypeScript. Both use Firebase services for backend functions: Firebase Authentication for user accounts and Cloud Firestore for storing and managing system information with real-time updates. The Administrator website is hosted on Firebase Hosting. The project uses the free Firebase Spark plan, so it does not use Cloud Functions or Firebase Storage; every write is made by the mobile application or the Administrator website and is checked by Cloud Firestore Security Rules.

       The map shown in the application uses MapLibre with OpenFreeMap map tiles. Road routes, road distances, and place search use OpenRouteService. The boundaries of the 20 barangays of Trinidad, Bohol are taken from the Philippines Subnational Administrative Boundaries published by PSA/NAMRIA through the OCHA Humanitarian Data Exchange.

       TriGo will support both Android and iOS mobile devices. Passengers and drivers will use their mobile devices to perform activities such as registration, booking, managing ride requests, updating availability, receiving in-app alerts and messages, and monitoring ride status. Passengers and drivers use the same mobile application; a passenger whose driver application is approved can switch to driver mode. Administrators use the Administrator website in a web browser.

       The system requires an active internet connection for core functions such as user authentication, ride booking, booking updates, in-app messages, payment-related information, and communication with Firebase services. Location-based functions also depend on the availability and accuracy of GPS and other location services on the user's device.

       The primary service area of TriGo is Trinidad, Bohol. However, trips with a pickup or destination outside the municipality may be accommodated as out-of-area requests when an available driver is willing to accept the request. For such trips, the fare is the Administrator's per-kilometre fare and is final; barangay tariffs do not apply, and commission applies to the completed trip in the same way as to any other trip.

           The main users of the TriGo Mobile Application are:

- Passengers – use the application to register, request and book rides, view fare information, monitor ride status, rate drivers, report problems, read messages from TriGo, and manage their ride history.

- Drivers – use the application to apply as drivers, manage their availability, receive and respond to booking requests, manage rides, record the payment method, pay commission, and view completed trips.

- Administrators – manage user accounts, verify drivers, monitor bookings and system activities, manage fares, barangay tariffs, the daily acceptance quota, commissions, payment records, complaints, warnings, and account deletion requests, and generate system reports.

	## Product Functions

       The Trigo: Transport Booking and Management Mobile Application for Trinidad, Bohol provides the following major functions:

**Passenger ****Functions**

- Register: Allows passengers to create a new account. Registration requires agreeing to the TriGo Privacy Notice and Terms of Use.

- Login: Allows passengers to securely access their accounts.

- Forgot Password: Allows passengers to reset a forgotten password by e-mail.

- Profile: Allows passengers to view their personal information.

- Edit Profile: Allows passengers to update their profile information.

- Book a Ride: Allows passengers to request a tricycle or motorcycle ride.

- Pickup Location: Allows passengers to set their pickup location by searching, tapping the map, or using their current location.

- Destination: Allows passengers to set their desired destination by searching or tapping the map.

- View Available Drivers: For out-of-area requests, allows passengers to confirm the driver who accepted the request or to choose another driver. Standard bookings are offered to all available drivers of the selected vehicle type.

- Fare Information: Displays the fixed fare for the requested ride before confirmation, together with the fare basis (barangay tariff or per-kilometre rate).

- Payment Method: Shows the payment method (Cash or GCash) that the driver recorded when the trip was completed.

- Confirm Booking: Allows passengers to review and confirm their ride request.

- Cancel Booking: Allows passengers to cancel a booking while no driver has accepted it, or after acceptance only if the driver has not arrived within the allowed waiting time.

- Booking Status: Allows passengers to view the current status of their booking.

- Ride Status: Allows passengers to monitor the progress of an active ride and to see the assigned driver's vehicle and contact number while the trip is active.

- Payment Information: Allows passengers to view the final fare and payment method associated with their ride.

- Ride History: Allows passengers to view their previous and completed rides.

- Rate Driver: Allows passengers to rate the driver of a completed trip once.

- Report a Problem: Allows passengers to report a problem about a booking.

- Notifications: Provides passengers with an in-app inbox of messages from TriGo, such as warnings, with an unread count on the Home screen. Booking updates are shown live on the booking status screen.

- Privacy and Account Deletion: Allows passengers to read the Privacy Notice and Terms of Use, see the version they agreed to, and request deletion of their account.

- Help and Support: Displays the support contacts set by the Administrator, with tap-to-call.

- Logout: Allows passengers to securely exit their accounts.

**Driver Functions**

- Register: Allows a registered user to apply as a driver by submitting personal and vehicle information (vehicle type, plate number, brand, model, and color) and the required documents.

- Login: Allows registered drivers to securely access their accounts.

- Driver Profile: Allows drivers to view their personal and vehicle-related information.

- Edit Profile: Driver and vehicle details are managed by the Administrator; drivers contact the Administrator to update them.

- Document Submission: Allows drivers to submit required documents for verification (OR/CR and LTO driver's license photos).

- Driver Verification Status: Allows drivers to view the status of their registration and verification.

- Booking Requests: Allows drivers to view incoming ride requests from passengers.

- View Booking Details: Allows drivers to view the details of a ride request.

- Accept Booking: Allows drivers to accept an available ride request.

- Decline Booking: Allows drivers to decline an available ride request.

- Availability: Allows drivers to set their status as online or offline and available or unavailable for bookings.

- Ride Management: Allows drivers to update the status of an accepted ride (arrived, in progress, completed) and to cancel before the ride starts.

- Payment Information: Allows drivers to record the payment method and view the final fare of completed rides.

- Trip History: Allows drivers to view their previous and completed trips.

- Earnings and Commission: Allows drivers to view fares collected, the commission owed, due dates, and their payment history, and to report a GCash commission payment.

- Daily Acceptance Quota: Shows drivers how many passengers they accepted today against the daily limit.

- Report a Problem: Allows drivers to report a problem about a booking.

- Notifications: Provides drivers with in-app alerts for new ride requests (vibration and local notifications while the application is running) and an inbox of messages from TriGo, such as warnings.

- Logout: Allows drivers to securely exit their accounts.

**Administrator Functions**

- Admin Login: Allows authorized administrators to securely access the Administrator website.

- Dashboard: Displays an overview of important system information, items that need attention, live statistics, charts, and recent activity.

- User Management: Allows administrators to view and search passenger accounts and view each passenger's bookings, complaints, and warnings.

- Driver Management: Allows administrators to view and search registered drivers, revoke or restore a driver's verification with a reason, and correct vehicle details.

- Driver Verification: Allows administrators to review, approve, or reject driver applications and submitted documents, with remarks.

- Booking Management: Allows administrators to view booking records in each passenger's and driver's history, on the Dashboard, and in complaint details. Administrators cannot edit bookings.

- Search Booking: Searching is available for passengers and drivers; a dedicated booking search page is not implemented (see Known Limitations).

- Filter Booking: Out-of-area trips can be filtered by date; a dedicated booking filter page is not implemented (see Known Limitations).

- Tariff Management: Allows administrators to set the per-kilometre fare (base fare and rate per kilometre) for each vehicle type and the barangay tariff for each barangay and vehicle type.

- Quota Management: Allows administrators to set the daily acceptance quota and monitor each verified driver's accepted count for the day.

- Commission Management: Allows administrators to set the commission percentage, payment period, and grace period.

- Payment Management: Allows administrators to confirm or reject drivers' GCash commission payments, record cash-outs, and view earnings totals and driver balances, with CSV export.

- Out-of-Area Trip Management: Allows administrators to monitor out-of-area requests, their drivers, fares, and timelines, and to turn out-of-area requests on or off.

- Complaint Management: Allows administrators to review complaints, set their status, keep private notes, and warn the reported user.

- Account Deletion: Allows administrators to process account deletion requests by anonymizing the account or declining the request with a note.

- Reports: Allows administrators to generate and view trip and fare reports for a date range, with charts and CSV export.

- System Monitoring: Allows administrators to monitor important system activities, records, and operational information.

- Notifications: Displays items that need the administrator's attention as Dashboard cards (pending payments, driver applications, open complaints, drivers behind on commission, and drivers at the daily limit) and as counts in the sidebar (including pending account deletion requests).

- Logout: Allows administrators to securely exit the management system.

	## User Characteristics

       The following user roles are defined within the system:

**PASSENGER**

A passenger is a person who uses TriGo to find and request tricycle or motorcycle transportation. Passengers are expected to have basic knowledge of using a smartphone, mobile applications, GPS/location services, and the available payment options such as Cash and GCash. Passengers must be at least 18 years old to hold an account.

**DRIVER**

A driver is a registered tricycle or motorcycle driver who uses TriGo to receive and manage ride requests. Drivers are expected to have basic knowledge of using a smartphone and mobile applications. Drivers must submit the required information and documents and be verified by an administrator before they can accept bookings. Drivers must be at least 18 years old and hold a valid driver's license.

**ADMINISTRATOR**

An administrator is an authorized user responsible for managing and monitoring the TriGo system through the Administrator website. Administrators manage passenger and driver accounts, verify drivers, monitor bookings and system activities, manage fares, tariffs, quotas, commissions, payment records, complaints, warnings, and account deletion requests, and generate system reports. Administrators are expected to have sufficient knowledge of the system's management functions and basic computer or web-based application operations. Administrator access is granted only by the development team, using a protected account setting (the `admin` custom claim).

	## Constraints

      This section explains the main limitations and conditions that the TriGo Mobile Application needs to follow. It includes the devices and internet connection needed to use the application, the transportation services covered, payment options, location-based services, and other factors that may affect how the system works.

The following constraints apply to the TriGo Mobile Application:

- Device Compatibility: The application is designed to function on supported Android and iOS mobile devices. Differences in device specifications, operating system versions, permissions, and device capabilities may affect the application's performance.

- Internet Connection: An active and stable internet connection is required for core functions such as user authentication, ride booking, booking updates, in-app messages, payment-related information, and communication with Firebase services.

- Location Services: Location-based functions depend on the availability and accuracy of the user's GPS and location services. Inaccurate or unavailable location information may affect pickup locations, destinations, driver matching, and route information.

- Road Route Requirement: A fare is calculated only from a road route returned by OpenRouteService. If no road route is available, the passenger cannot book; straight-line distances are never used for fares.

- Transportation Coverage: TriGo primarily supports tricycle and motorcycle transportation services within Trinidad, Bohol. Trips outside the municipality may be accommodated only when an available driver is willing to accept the request.

- Out-of-Area Trips: For trips with a pickup or destination outside Trinidad, the fare is the Administrator's per-kilometre fare and is final. An out-of-area request is offered to one driver at a time and expires after the time set by the Administrator. The availability of such trips depends on driver availability and willingness to accept the request.

- Driver Availability: The system cannot guarantee that a driver will always be available. Ride requests depend on the number and availability of registered and verified drivers.

- Driver Verification: Drivers must complete the required registration and verification process before they are allowed to accept passenger bookings.

- Payment Options: The system records Cash and GCash as payment options within the defined project scope. TriGo does not process payments; passengers pay drivers directly. Other digital payment platforms and bank transfer methods are not included unless implemented in a future version.

- GCash Dependency: Drivers pay commission to TriGo's GCash account outside the application and enter the GCash reference number; the Administrator verifies each payment manually. No payment gateway is integrated.

- Tariff Management: Applicable fare rates depend on the per-kilometre fares and barangay tariffs configured by the administrator. Changes to these settings apply to new bookings.

- Quota Management: The daily acceptance quota depends on the limit configured by the administrator (a whole number from 1 to 100; 20 until one is saved).

- Commission Management: Applicable commissions depend on the commission percentage, payment period, and grace period configured by the administrator.

- Third-Party Services: The system depends on Firebase, OpenRouteService, OpenFreeMap, and other applicable third-party services. Service interruptions, changes, or limitations from these providers may affect certain system functions.

- Firebase Plan: The project uses the free Firebase Spark plan. Functions that need Cloud Functions or Firebase Storage (server-side processing, push notifications to a closed application, and file uploads) are not available on this plan.

- Local Transportation Focus: TriGo is primarily designed for local transportation operations in Trinidad, Bohol and is not intended to function as a nationwide transportation booking application.

- User Responsibility: Passengers and drivers are responsible for providing accurate information and following applicable transportation arrangements and rules when using the system.

### 2.4.1. Hard Constraints 

    This section describes the requirements that the Trigo Mobile Application must follow. These include the supported mobile devices, internet connection, transportation coverage within Trinidad, Bohol, driver verification, payment options, and the technologies required to develop and operate the system.

-  The following are the hard constraints of the system:

- Mobile Application: The system must be developed as a mobile application that supports both Android and iOS devices.

- Internet Connection: An active internet connection must be available for important functions such as user registration, login, ride booking, booking updates, in-app messages, payment-related information, and communication with the system.

- Service Area: The application must primarily support tricycle and motorcycle transportation services within the Municipality of Trinidad, Bohol.

- Out-of-Area Trips: Trips with a pickup or destination outside Trinidad, Bohol may be accommodated when a registered and verified driver is available and willing to accept the request. The fare is the Administrator's per-kilometre fare and is final.

- Registered and Verified Drivers: Drivers must register and submit the required information and documents. Drivers must be verified by an administrator before they can accept passenger booking requests.

- User Accounts: Users must have a valid registered account to access the booking and management features available to their respective roles.

- Location Services: GPS or location services must be available and enabled when using location-based functions such as selecting pickup locations, destinations, and identifying available drivers.

- Firebase Services: The system must use Firebase services, including Firebase Authentication and Cloud Firestore, for user authentication, data storage, and other applicable backend functions. The system depends on the availability of these services.

- Access Control: Every read and write of Cloud Firestore data must be allowed by the Cloud Firestore Security Rules, which check the user's role and the validity of the data.

- Payment Options: The system must record Cash and GCash as the defined payment options within the project scope.

- Tariff Management: Applicable transportation fares must follow the per-kilometre fares and barangay tariffs configured by the administrator.

- Quota Management: Drivers must not accept more passengers in one day (Manila time) than the daily acceptance quota configured by the administrator.

- Commission Management: Applicable service or platform commissions must follow the commission percentage and rules configured by the administrator.

- User Information: Passengers and drivers must provide accurate and valid information required for registration, booking, verification, and other system functions.

- Data Privacy: The system must collect, use, and keep personal data according to the Data Privacy Act of 2012 (RA 10173), including consent at registration and a way to request account deletion.

- Platform and Service Dependency: The application's functionality may be affected by the availability of Firebase, OpenRouteService, map tile services, GCash, GPS/location services, internet connectivity, and other third-party services required by the implemented system.

### 2.4.2. Soft Constraints 

 This section describes the conditions that are preferred for the TriGo Mobile Application but may be adjusted or improved during development based on testing, user feedback, and project requirements. These include usability, interface design, information presentation, application performance, and the overall convenience of the system for passengers, drivers, and administrators.

The following are the soft constraints of the system:

- Simple User Interface: The application should provide a simple, clear, and easy-to-understand interface so that passengers, drivers, and administrators can use the system without unnecessary difficulty.

- Convenient Booking Process: The passenger booking process should be kept simple and efficient to allow users to request transportation with minimal steps.

- Clear Information: Booking details, pickup and destination locations, fare information, driver information, payment method, booking status, and ride information should be presented clearly to avoid confusion.

- Easy Payment Selection: The application should make it easy for the driver to record whether the passenger paid in Cash or by GCash when completing a trip, and should show the recorded payment method to both users.

- User-Friendly Driver Functions: Driver features such as availability management, booking requests, ride status updates, and trip history should be easy to understand and operate.

- Accessible Administrative Functions: Administrative features for managing users, drivers, bookings, tariffs, quotas, commissions, payments, and reports should be organized in a way that allows administrators to efficiently perform their tasks.

- Responsive Design: The application's interface should adapt appropriately to supported Android and iOS mobile devices and different screen sizes.

- Accessibility: Text should keep sufficient contrast for outdoor use, and buttons should have touch targets of about 48 density-independent pixels.

- Application Performance: The application should respond properly and load its features within a reasonable amount of time when a stable internet connection and required external services are available.

- Readable Notifications: Notifications and system messages should provide clear and understandable information about booking requests, booking status, ride updates, payments, and other important activities.

- Continuous Improvement: The application's interface and features may be improved based on user feedback, testing results, evaluation, and identified usability issues during development.

	## Assumptions and Dependencies

      This section describes the conditions that are expected to be available or working for the TriGo Mobile Application to function properly.

The following assumptions and dependencies apply to the system:

- Compatible Devices: Users are expected to have a supported Android or iOS mobile device capable of running the TriGo application.

- Internet Availability: Users are expected to have a stable internet connection when using online features such as account access, ride booking, booking updates, in-app messages, payment-related functions, and real-time communication.

- Accurate User Information: Passengers and drivers are expected to provide correct, complete, and updated information during registration and when using the system.

- Driver Availability: The system assumes that registered and verified drivers will accurately update their availability status so passengers can identify drivers who may be able to accept booking requests.

- Driver Verification: The system depends on administrators to review and verify driver applications and submitted documents before drivers are allowed to accept passenger bookings.

- Firebase Availability: The system depends on Firebase services for user authentication, Cloud Firestore data storage, real-time communication, and hosting of the Administrator website.

- GPS and Location Services: Location-based features depend on the user's device having GPS/location services enabled and available. The accuracy of location information depends on the device and available location services.

- Mapping and Location Services: Fare, route, pickup, destination, and place-search features depend on the availability and accuracy of OpenRouteService and the OpenFreeMap map tiles. OpenRouteService is used within its free usage limits.

- GCash Availability: Commission payments depend on the availability of GCash services and on the Administrator verifying each reported GCash reference number.

- Payment Information: The system assumes that drivers will record the payment method used by the passenger (Cash or GCash) when completing a trip.

- Tariff Configuration: The system depends on administrators to maintain accurate per-kilometre fares and barangay tariffs.

- Quota Configuration: The system depends on administrators to maintain the daily acceptance quota.

- Commission Configuration: The system depends on administrators to maintain the applicable commission percentage, payment period, and grace period.

- Driver Participation: The system assumes that registered drivers will actively use the application and respond to booking requests when they are available.

- Third-Party Services: The functionality of the application may depend on the availability of external services such as Firebase, OpenRouteService, OpenFreeMap, GCash, GPS/location services, and internet connectivity.

	## Known Limitations and Future Enhancements

      This section describes functions that are planned or partly built but are not fully available in the current version, and the reason for each. These items are not claimed as working features.

- Passenger Profile Photos: Storing profile photos requires Firebase Storage, which needs the Firebase Blaze plan, so passenger profile photos are not available in the current version. Driver application documents are not affected: since 2026-11-17 the OR/CR and LTO driver's license photos are stored in Cloud Firestore, so drivers can complete an application through the application.

- Push Notifications: Ride request alerts are created by the application itself while it is running (vibration on screen and a local notification in the background). Alerts cannot reach an application that is closed, and on iOS background alerts are practically unavailable. True push notifications need Cloud Functions and the Blaze plan.

- Booking Updates for Passengers: Booking status changes are shown live on the passenger's booking status screen; they are not sent to the passenger's inbox or as push notifications.

- Driver Online Status: A driver who closes the application remains marked online until they go offline, so a passenger may wait on a driver who does not see the request until it expires. A presence or heartbeat check is planned.

- Server-Side Checks: Without Cloud Functions, the Firestore Security Rules cannot confirm that a pin is inside the barangay used for a barangay tariff, and expired bookings and out-of-area requests are shown as expired from their expiry time rather than being updated on the server.

- GCash Verification: Commission payments are verified by hand by the Administrator. A wrongly confirmed payment or cash-out record cannot be edited. Automatic payments through a payment provider (for example, PayMongo) would require a registered business and the Blaze plan.

- Place Search Coverage: Place search uses OpenRouteService with OpenStreetMap data, which has few Trinidad landmarks; passengers can choose a barangay and tap the exact spot on the map instead.

- Administrator Booking Search: A dedicated booking search and filter page is not implemented; booking records are viewed per passenger and per driver.

- Passenger Suspension: Administrators can revoke a driver's verification, but suspending a passenger account is not implemented. Warnings are counted, and any suspension is decided by the Administrator.

- Account Deletion: The Administrator anonymizes the account data in TriGo; the sign-in account is then deleted by hand in the Firebase Console, because there are no Cloud Functions.

- Vehicle Fleet: The Vehicle Fleet prototype (Figure 24.0) was not implemented.

- Announcements: The in-app inbox is designed to also hold announcements from TriGo in a later version.

		# Specific Requirements

      This section provides information about the system features, user requirements, performance, security, and other requirements needed to ensure that the application works properly for commuters, drivers, and administrators.

	## External Interfaces Requirements

		

		     External Interface Requirements specify the hardware and software with which the TriGo Mobile Application must interact. This section provides information to ensure that the application can communicate properly with mobile devices, internet services, Firebase, and other external components needed for the system to function.

		

### 3.1.1. Hardware Interfaces 

		

		            A computer is required for the development, testing, configuration, and administration of the TriGo Mobile Application, while smartphones are used by passengers and drivers to access and use the application. Administrators use a computer or other device with a modern web browser to access the Administrator website.

		

		The following are the recommended minimum hardware specifications:

		

		**Development Computer:**

		

		- Processor: Intel Core i5 or equivalent

		- RAM: 8 GB

		- Storage: 256 GB SSD

		- Internet Connection: Stable broadband or Wi-Fi connection

		

		**User Mobile Device:**

		Processor: Quad-core processor or equivalent

		RAM: 3 GB or higher

		Storage: At least 32 GB available storage

		Operating System: Supported Android or iOS version

		GPS: GPS/location capability for location-based features

		Internet Connection: Wi-Fi or mobile data

		

		      The mobile device must have sufficient hardware capabilities to run the TriGo application and support functions such as user authentication, ride booking, GPS/location services, notifications, ride monitoring, and payment-related features.

		

### 3.1.2. Software Interfaces

		

		**Development Computer**:

		Operating System: Windows 10/11

		Development Framework: React Native 0.85 with Expo SDK 56 (Expo Router) for the mobile application; React 19 with Vite 8 for the Administrator website

		Programming Language: TypeScript / JavaScript

		Database: Cloud Firestore

		Backend Service: Firebase (Spark plan): Firebase Authentication, Cloud Firestore, Firebase Hosting

		Authentication: Firebase Authentication

		Map Display: MapLibre React Native with OpenFreeMap map tiles

		Routing and Place Search: OpenRouteService (directions and geocoding)

		Device Services: Expo Location (GPS), Expo Notifications (local notifications), Expo Image Picker (document photos)

		Testing: Firebase Local Emulator Suite with @firebase/rules-unit-testing; Node.js built-in test runner

		Development Tool: Visual Studio Code

		Version Control: Git and GitHub

		System Diagram Tool: Draw.io

		

		**Software Interfaces Used at Run Time:**

		- Firebase Authentication: e-mail and password sign-in for passengers, drivers, and administrators.

		- Cloud Firestore: all application data, with real-time listeners for booking status, ride requests, and messages.

		- OpenRouteService: road route and distance for every fare, and place search biased to Trinidad, Bohol.

		- OpenFreeMap: map tiles shown in the application.

		- Device GPS: the passenger's current location and the driver's position while online.

		- Phone application: tap-to-call for trip contacts and support contacts.

		

	## Functional Requirements

### 3.2.1. Use Case

**3.2.1.1. ****Passenger**** Registration Use Case**

Figure 1.0 Passenger Registration Use Case

**3.2.1.2.**** ****Passenger ****Login Use Cas**

Figure 2.0 Passenger Login Use Case

**3.2.1.3.** **Passenger**** ****Dashboard**** Use Case **

Figure 3.0 Passenger Dashboard Use Case 

**3.2.1.4. ****Passenger Profile ****Use Cas****e**

Figure 4.0 Passenger Profile Use Case 

**3.2.1.4. Driver Registration Use Case**

Figure 5.0 Driver Registration Use Case

**3.2.1.5. Driver Login Use Case**

Figure 6.0 Driver Login Use Case

**3.2.1.5. Driver ****Dashboard**** Use Case**

Figure 7.0 Driver Dashboard Use Case

**3.2.1.****6****. Driver ****Profile Use Case**

Figure 8.0 Driver Profile Use Case

**3.2.1.****7****. ****Admin Login**** ****Use Case**

Figure 9.0 Admin Login Use Case

### 3.2.2. Prototype 

**3.2.2.1.**** ****Passenger**** Registration ****a****nd Login ****Prototype**

Figure 10.0 Passenger Registration and Login Prototype

**3.2.2.****2****. ****Passenger ****Dashboard View Prototype **

Figure 11.0 Passenger Dashboard View Prototype

**3.2.****2.3. Booking Process Prototype**

 

Figure 12.0 Booking Process Prototype

**3.2.2.4**** ****Passenger Activity ****and Notifications ****View Prototype**

Figure 13.0 Passenger Activity and Notifications View Prototype

**3.2.2.5**** ****Passenger Settings and Profile View Prototype**** **

Figure 14.0 Passenger Settings and Profile View Prototype

**3.2.2.****6****.** **Driver Registration ****and Login ****Prototype **

Figure 15.0 Driver Registration and Login Prototype

**3.2.2.7. Driver Dashboard View Prototype **

Figure 16.0 Driver Dashboard View Prototype

**3.2.2.8. ****Trips View Prototype**

Figure 17.0 Trips View Prototype

**3.2.2.9.**** ****Earnings**** Dashboard ****and Profile ****View Prototype**

Figure 18.0 Earnings Dashboard and Profile View Prototype

Note: In the implemented system, the Earnings tab shows the fares collected and the commission owed to TriGo (see 3.2.3.7).

**3.2.2.10.**** ****Vehicle Info ****and ****Driver Rating ****View Prototype**

Figure 19.0 Vehicle Info and Driver Rating View Prototype

**3.2.2.11. Admin Login ****Prototype**

Figure 20.0 Admin Login Prototype

**3.2.2.12. ****Admin Dashboard ****View Prototype**

Figure 21.0 Admin Dashboard View Prototype

**3.2.2.13. Passenger Management ****Prototype**

Figure 22.0 Passenger Management Prototype

**3.2.2.14. Driver Management Prototype**

Figure 23.0 Driver Management Prototype

**3.2.2.15. ****Vehicle ****Fleet Prototype**

Figure 24.0 Vehicle Fleet Prototype

Note: The Vehicle Fleet feature was not implemented. Each driver has one vehicle (type, plate number, brand, model, and color), managed by the Administrator.

**3.2.2.16. ****Fare Management Prototype**

Figure 25.0 Fare Management Prototype

### 3.2.3. Implemented Functional Requirements

      This section states the functional requirements of the implemented system in detail. Each requirement is enforced in the mobile application or the Administrator website and, where data is written, by the Cloud Firestore Security Rules.

**3.2.3.1. Fare Calculation**

- The system shall calculate every fare from the road distance returned by OpenRouteService; if no road route is available, the system shall not allow the booking.

- The system shall charge a trip between Poblacion and a point inside another barangay of Trinidad, in either direction, that barangay's active tariff for the selected vehicle type, using the official barangay boundaries.

- The system shall charge every other trip, including out-of-area trips, the per-kilometre fare: the Administrator's base fare plus the rate per kilometre for the vehicle type, multiplied by the road distance and kept to the centavo.

- The system shall show the fixed fare and its basis ("Barangay tariff · Poblacion ↔ barangay" or the per-kilometre rate) before the passenger confirms, and shall ask the passenger to confirm again if a tariff changed in the meantime.

- The system shall use the per-kilometre fare if barangay tariffs cannot be loaded within about 5 seconds.

**3.2.3.2. Location Search**

- The system shall match the 20 barangays of Trinidad on the phone as the passenger types, from 2 characters, allowing common aliases and small typing errors, and shall place the pin inside the chosen barangay with a hint to move it to the exact spot.

- The system shall search places through OpenRouteService biased to Trinidad, Bohol, list places inside Trinidad first with their barangay, and use the phone's geocoder if OpenRouteService returns nothing.

**3.2.3.3. Booking Expiry and Cancellation**

- The system shall let a standard booking that no driver accepts expire after the time set by the Administrator (1 to 30 minutes, 10 by default), and shall offer the passenger a one-tap way to try again.

- The system shall let the passenger cancel a booking at any time before a driver accepts it.

- After a driver accepts, the system shall allow the passenger to cancel only if the driver has not marked "arrived" within 15 minutes of accepting; once the driver has arrived or the trip is in progress, the passenger shall not be able to cancel.

- The system shall let the assigned driver cancel a booking before the ride starts.

**3.2.3.4. Out-of-Area Requests**

- The system shall treat a trip as out-of-area when its pickup or destination is outside Trinidad, Bohol.

- The system shall offer an out-of-area request to one driver at a time, within the search radius set by the Administrator (1 to 50 km), at the per-kilometre fare, which is final.

- The system shall let the passenger confirm the driver who accepted or choose another driver, and shall let the Administrator turn out-of-area requests on or off and set their expiry time (1 to 30 minutes).

**3.2.3.5. Active Trip and Contact**

- The system shall show the passenger the assigned driver's name, vehicle (color, brand, model, and plate number), and contact number, and show the driver the passenger's name and contact number, only while the trip is accepted, arrived, or in progress.

- The system shall let the driver mark the trip as arrived, in progress, and completed, and record the payment method (Cash or GCash) and the final fare at completion.

**3.2.3.6. Ride Request Alerts**

- The system shall alert an online and available driver of each new unexpired ride request by vibration while the application is on screen and by a local notification while the application is running in the background.

- The system shall remove the alert when the request is taken, cancelled, expired, or declined.

**3.2.3.7. Commission**

- The system shall record, with each completed trip, a commission equal to the Administrator's percentage of the final fare, rounded to the centavo.

- The system shall group commission into payment periods set by the Administrator, followed by a grace period, and show the driver the balance, due date, and status.

- The system shall let the driver report a GCash payment of at least ₱1.00 with its reference number (each reference number usable once), apply payments to the oldest debt first, and let the Administrator confirm or reject each payment with a reason.

- The system shall warn a driver whose payment is overdue and stop a driver from accepting bookings when the grace period ends unpaid, until a confirmed payment covers the overdue amount; the driver can still sign in, finish a current trip, and pay.

- The system shall let the Administrator record cash-outs (GCash, Maya, or bank transfer) up to the amount collected; these are records only.

**3.2.3.8. Daily Acceptance Quota**

- The system shall limit each driver to the daily number of accepted passengers set by the Administrator (1 to 100; 20 until one is saved), counted per Manila calendar day and reset at 12:00 AM.

- The system shall give the slot back when the passenger cancels before the trip starts, and shall show the driver "Accepted today: X of N".

**3.2.3.9. Driver Rating**

- The system shall let the passenger of a completed trip rate the driver once, within 7 days, with 1 to 5 stars, optional tags from a fixed list, and an optional comment of up to 300 characters.

- The system shall show each driver's rating as the average to one decimal, or "New" before the first rating. Ratings cannot be edited or deleted.

**3.2.3.10. Complaints, Warnings, and Inbox**

- The system shall let the passenger or the assigned driver report one problem per booking, with a category (driver behavior, passenger behavior, fare or payment, safety, lost item, app problem, or other) and a message of up to 1,000 characters, and shall record which user the complaint is about.

- The system shall let the Administrator set a complaint's status (open, in review, or resolved) and keep private notes; the reporter sees the status but not the notes.

- The system shall let the Administrator warn the user a complaint is about, with a reason of up to 500 characters, at most once per complaint, and later withdraw the warning. Warnings shall be counted only; suspension shall remain the Administrator's decision.

- The system shall show the warned user the warning in an in-app inbox, newest first, with unread messages highlighted, and let the user acknowledge it once with "I understand". The passenger's Home screen shall show the number of unread messages, and the driver's Home screen shall show a banner while a warning is unread.

**3.2.3.11. Data Privacy and Account Deletion**

- The system shall require new users to agree to the current versions of the Privacy Notice and Terms of Use at registration, record the version and date, and ask existing users to agree again when the version changes.

- The system shall show the Privacy Notice and Terms of Use in the application and on public pages of the Administrator website, and shall show drivers a privacy notice on the driver application.

- The system shall let a user request deletion of their account with an optional reason, and withdraw the request while it is pending.

- The system shall let the Administrator decline a request with a note the user reads, or anonymize the account in one step: remove the name, e-mail address, mobile number, and photo; delete the contact card; blank driver and driver application details; and clear the reasons of warnings received. Trip, rating, complaint, warning, and commission records shall be kept without the name.

**3.2.3.12. Administrator Website**

- The system shall allow only accounts with the administrator account setting to sign in to the Administrator website.

- The system shall provide these sections: Dashboard (Overview and Reports), Drivers (Applications and All drivers), Passengers, Trips (Out-of-area trips), Earnings, Complaints (against drivers and against passengers), Account deletion, and Settings (Fares, Barangay tariffs, Commission, Quota, and System).

- The system shall build reports from Cloud Firestore count and sum totals for a date range of up to 366 days, charted per day (up to 62 days) or per month, and export them as CSV.

- The system shall let the Administrator manage support contacts and TriGo's GCash account name and number, which drivers see when paying commission.

	## Performance Requirements

       This section describes how well the TriGo application should perform when users access and use its features.

### 3.3.1. Execution Time 

       The system should respond within a reasonable time when users log in, submit bookings, receive updates, and access other features. Requests to external services are limited in time so the application does not wait indefinitely: barangay tariffs fall back to the per-kilometre fare after about 5 seconds, and place-search requests stop after 8 seconds.

### 3.3.2. Efficiency

       The application should use its available resources efficiently and allow passengers, drivers, and administrators to complete their tasks without unnecessary delays. To stay within the free OpenRouteService limits, place search is sent only from 3 characters, after a 400-millisecond pause in typing, once per identical text per session, and not at all for exact barangay names. Administrator reports use count and sum totals instead of downloading every booking.

	## Design Constraints

      This section describes the design requirements and limitations that should be followed when developing the TriGo application.

### 3.4.1. Software Language

      The application uses TypeScript (with JavaScript only where unavoidable) with React Native and Expo for the mobile application and React with Vite for the Administrator website, while Firebase is used for backend services and data storage.

### 3.4.2. Graphical-User Interface

The graphical user interface shall:

- Have a simple and understandable design.

- Provide clear navigation.

- Use readable text and buttons.

- Clearly display booking information.

- Clearly display fare information.

- Provide feedback after important user actions.

- Use interfaces appropriate for Android and iOS mobile devices.

- Display functions according to the user's role.

	## Software System Attributes

     This section describes the qualities that TriGo should have to provide a reliable, secure, and convenient experience for its users.

### 3.5.1. Reliability 

  The system should:

- Process valid user requests correctly.

- Validate required information.

- Maintain accurate booking records.

- Handle invalid input appropriately.

- Prevent unauthorized access to restricted functions.

- Maintain correct user and driver information.

- Keep related records consistent by writing them together in one operation (for example, a completed trip and its commission).

### 3.5.2. Availability

     The application should be available when the application services and required Firebase services are operational.

An active internet connection is required for:

- Login

- Registration

- Ride booking

- Booking updates

- In-app messages and ride request alerts

- Database access

### 3.5.3. Security 

     The system should protect user accounts and personal information by using proper authentication, access control, and secure handling of data stored in the application. In the implemented system:

- Users sign in with Firebase Authentication. Administrator access is granted only through a protected account setting (the `admin` custom claim) that no user can give themselves.

- Every read and write of Cloud Firestore is checked by Cloud Firestore Security Rules according to the user's role (Passenger, Driver, or Administrator) and the validity of the data, including fares, booking status changes, the daily acceptance quota, and commission amounts.

- Contact numbers are visible only to the passenger and the assigned driver while their trip is active.

- The Security Rules are tested automatically on the Firebase Local Emulator Suite for both allowed and refused operations.

- Personal data is handled according to the Data Privacy Act of 2012 (RA 10173), as described in the TriGo Privacy Notice.

### 3.5.4. Maintainability

     The application should be organized and structured in a way that allows the development team to easily identify problems, fix errors, update existing features, and add improvements when needed. Business decisions made during development are recorded in a decisions log, and calculations such as fares, commission, and the daily quota are covered by automated unit tests.

### 3.5.5. Portability

 

      The application should support both Android and iOS devices, allowing commuters and drivers to use its main features across supported mobile platforms without major changes to the system.

	## Data Requirements

      TriGo stores its data in Cloud Firestore. The main collections are listed below. Each collection is protected by the Cloud Firestore Security Rules.

| **Collection** | **Data Stored** |
| --- | --- |
| users | Profile of each passenger and driver: name, e-mail, mobile number, role, and the Privacy Notice version agreed to (with a log of agreements per version). |
| contacts | Name and mobile number shared with the other side of an active trip. |
| bookings | Standard and out-of-area trips: pickup, destination, distance, fare and fare basis, status and its times, payment method, final fare, and cancellation details. |
| outOfAreaRequests | Out-of-area requests offered to drivers, with the driver who accepted and the fare. |
| drivers | Driver record: vehicle type, plate number, brand, model, color, verification, online and availability status, current position while online, and the daily accepted count. |
| driverApplications | Driver applications with personal and vehicle details, document references, status, and remarks. |
| fareSettings, barangayTariffs | Per-kilometre fares, booking and out-of-area settings, and the barangay tariffs. |
| commissionSettings, commissions, commissionAccounts, commissionPeriods | Commission percentage and periods, the commission of each trip, and each driver's balance. |
| paymentSettings, commissionPayments, paymentReferences, earningsLedger, cashOuts | TriGo's GCash account, drivers' reported payments, used reference numbers, earnings totals, and recorded cash-outs. |
| quotaSettings | The daily acceptance quota. |
| ratings, driverRatings | One rating per completed booking and each driver's rating totals. |
| complaints, warnings | Complaints from bookings and the warnings issued from them. |
| deletionRequests | Account deletion requests and their outcome. |
| supportContacts | Support contacts shown in the application. |

Table 2.0 Data Stored in Cloud Firestore

|  | Page │ **1** |
| --- | --- |
