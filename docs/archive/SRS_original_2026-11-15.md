| Software Requirement Specification  Trigo: Transport Booking and Management Mobile Application for Trinidad, Bohol |  |
| --- | --- |

Software Requirement Specification

for

Trigo: Transport Booking and Management Mobile Application for Trinidad, Bohol

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

		# Overview

        This section provides a general description of the TriGo: Transport Booking and Management Mobile Application for Trinidad, Bohol. It introduces the purpose of the system, its main features, intended users, and the requirements that guide the development of the application.

	## Project Summary

		

		      TriGo: Transport Booking and Management Mobile Application for Trinidad, Bohol is a proposed mobile application designed to make it easier and more convenient for passengers to book tricycle and motorcycle rides within the Municipality of Trinidad, Bohol.

		      

			 The application aims to improve the usual way of finding transportation, especially when passengers have to wait for a long time during busy hours or bad weather. It also helps address common problems such as unclear fares, difficulty communicating with drivers, and finding an available ride.

		      

			 With TriGo, passengers can request and book rides through the application, while registered and verified drivers can receive booking requests, manage their availability, and update the status of their rides. The system provides booking status, fare information, Cash and GCash payment options, notifications, and ride and trip history.

		

		       The system also provides administrative management, reports, and system monitoring. Administrators can manage passenger and driver accounts, verify driver applications and submitted documents, monitor bookings and system activities, and manage transportation-related settings such as tariffs, quotas, and commissions.

		       TriGo primarily supports transportation services within Trinidad, Bohol. Trips to destinations outside the municipality may also be accommodated when a driver is available and willing to accept the request. For such trips, the passenger and driver may agree on the applicable fare based on the transportation arrangement.

			 

		      The application is designed to be functional on both Android and iOS mobile devices. Overall, TriGo is designed to make the transportation booking process more organized, convenient, accessible, and transparent for passengers, drivers, and administrators in the local community.

		

	## Definition, Acronyms, and Abbreviations

| **Terms** | **Definition** |
| --- | --- |
| SRS | Software Requirements Specification – a document that describes the system requirements and expected functions |
| TriGo | Is a mobile application that helps users book transportation and travel to their desired destination within Trinidad, Bohol. |
| iOS | iPhone Operating System - is the core software that runs on Apple’s mobile devices like the iPhone. |
| GPS | Global Positioning System used to determine geographical location. |
| Firebase | A Google platform that provides backend services such as authentication, database, and cloud functions. |
| GCash | Is a Philippine mobile payments service owned by Globe Fintech Innovations, Inc. (doing business as Mynt), and operated by its wholly owned subsidiary, G-Xchange, Inc. |
| Prototype | This is an initial creation of the product that shows the basics of what a product looks like, what a product do and how it operates. |

		

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

		

		# Overall Description

        TriGo: Transport Booking and Management Mobile Application for Trinidad, Bohol is a mobile application designed to make it easier for passengers to find and book tricycle and motorcycle rides within the Municipality of Trinidad, Bohol. It provides a convenient platform for passengers to request transportation while allowing registered and verified drivers to receive booking requests, manage their availability, and manage their rides.

         This section describes the overall features and functions of the TriGo Mobile Application. It also identifies the intended users, operating environment, technologies, and general conditions and limitations that may affect the system. The information presented in this section provides a general description of the system and serves as a guide for defining the detailed functional and non-functional requirements of the application.

	## Product Perspective

      TriGo is a standalone mobile transportation booking and management application designed to connect passengers with registered and verified tricycle and motorcycle drivers primarily within the Municipality of Trinidad, Bohol. Instead of relying only on traditional methods of waiting or searching for available transportation, passengers can use the application to request a ride, provide their pickup and destination locations, view applicable fare information, and monitor their booking status.

      Registered and verified drivers can receive passenger booking requests, accept or decline requests, manage their availability, update ride status, and view their completed ride history. The system also provides Cash and GCash as available payment options for supported transportation transactions.

      The application includes an Administrator component for managing and monitoring the overall system. Administrators can manage passenger and driver accounts, verify driver applications and submitted documents, monitor bookings and system activities, generate reports, and manage transportation-related settings. These settings include tariffs, quotas, and commissions, which help administrators manage fare rates, applicable limits, and service charges within the system.

       The application will be developed using React Native with Expo for mobile development and TypeScript and JavaScript for programming. Firebase services will be used for backend functions, including Firebase Authentication for user accounts and Cloud Firestore for storing and managing system information. The application will also use applicable Firebase services for real-time data communication and other backend requirements.

       TriGo will support both Android and iOS mobile devices. Passengers and drivers will use their mobile devices to perform activities such as registration, booking, managing ride requests, updating availability, receiving notifications, and monitoring ride status. Administrators will also access the appropriate system functions through the supported application environment.

       The system requires an active internet connection for core functions such as user authentication, ride booking, booking updates, notifications, payment-related information, and communication with Firebase services. Location-based functions also depend on the availability and accuracy of GPS and other location services on the user's device.

       The primary service area of TriGo is Trinidad, Bohol. However, trips to destinations outside the municipality may be accommodated when an available driver is willing to accept the request. For such trips, the passenger and driver may agree on the applicable fare based on the transportation arrangement, while applicable tariff and commission rules configured in the system may still be considered.

           The main users of the TriGo Mobile Application are:

- Passengers – use the application to register, request and book rides, view fare information, select available payment options, monitor ride status, receive notifications, and manage their ride history.

- Drivers – use the application to register, submit verification information, manage their profiles and availability, receive and respond to booking requests, manage rides, and view completed trips.

- Administrators – manage user accounts, verify drivers, monitor bookings and system activities, manage tariffs, quotas, commissions, payment-related records, and generate system reports.

	## Product Functions

       The Trigo: Transport Booking and Management Mobile Application for Trinidad, Bohol provides the following major functions:

**Passenger ****Functions**

- Register: Allows passengers to create a new account.

- Login: Allows passengers to securely access their accounts.

- Profile: Allows passengers to view their personal information.

- Edit Profile: Allows passengers to update their profile information.

- Book a Ride: Allows passengers to request a tricycle or motorcycle ride.

- Pickup Location: Allows passengers to enter or select their pickup location.

- Destination: Allows passengers to enter or select their desired destination.

- View Available Drivers: Allows passengers to view available drivers for their requested ride when applicable.

- Fare Information: Displays the applicable or estimated fare for the requested ride.

- Payment Method: Allows passengers to select an available payment method, such as Cash or GCash.

- Confirm Booking: Allows passengers to review and confirm their ride request.

- Cancel Booking: Allows passengers to cancel an active booking when permitted.

- Booking Status: Allows passengers to view the current status of their booking.

- Ride Status: Allows passengers to monitor the progress of an active ride.

- Payment Information: Allows passengers to view relevant payment information associated with their ride.

- Ride History: Allows passengers to view their previous and completed rides.

- Notifications: Provides passengers with booking updates, ride notifications, and other important system information.

- Logout: Allows passengers to securely exit their accounts.

**Driver Functions**

- Register: Allows drivers to submit their personal, vehicle, and required information for registration.

- Login: Allows registered drivers to securely access their accounts.

- Driver Profile: Allows drivers to view their personal and vehicle-related information.

- Edit Profile: Allows drivers to update their profile information.

- Document Submission: Allows drivers to submit required documents for verification.

- Driver Verification Status: Allows drivers to view the status of their registration and verification.

- Booking Requests: Allows drivers to view incoming ride requests from passengers.

- View Booking Details: Allows drivers to view the details of a ride request.

- Accept Booking: Allows drivers to accept an available ride request.

- Decline Booking: Allows drivers to decline an available ride request.

- Availability: Allows drivers to set their status as available or unavailable for bookings.

- Ride Management: Allows drivers to update the status of an accepted ride as applicable.

- Payment Information: Allows drivers to view relevant payment information associated with completed rides.

- Trip History: Allows drivers to view their previous and completed trips.

- Notifications: Provides drivers with booking requests, ride updates, and other important system notifications.

- Logout: Allows drivers to securely exit their accounts.

**Administrator Functions**

- Admin Login: Allows authorized administrators to securely access the management system.

- Dashboard: Displays an overview of important system information, activities, bookings, and transactions.

- User Management: Allows administrators to view and manage passenger and driver accounts.

- Driver Management: Allows administrators to view and manage registered driver information.

- Driver Verification: Allows administrators to review, approve, or reject driver applications and submitted documents.

- Booking Management: Allows administrators to view and manage booking records.

- Search Booking: Allows administrators to search for specific booking records.

- Filter Booking: Allows administrators to filter booking records based on available information.

- Tariff Management: Allows administrators to add, view, update, and manage applicable transportation tariff rates and pricing rules.

- Quota Management: Allows administrators to configure and monitor applicable quotas or operational limits within the system.

- Commission Management: Allows administrators to configure and manage applicable service or platform commission rates.

- Payment Management: Allows administrators to view and monitor payment information and transaction records, including supported Cash and GCash transactions.

- Out-of-Area Trip Management: Allows administrators to monitor eligible trips outside the primary service area and their associated fare and transaction information.

- Reports: Allows administrators to generate and view transportation-related reports, including booking, trip, payment, and transaction information.

- System Monitoring: Allows administrators to monitor important system activities, records, and operational information.

- Notifications: Allows administrators to view important system notifications and updates.

- Logout: Allows administrators to securely exit the management system.

	## User Characteristics

       The following user roles are defined within the system:

**PASSENGER**

A passenger is a person who uses TriGo to find and request tricycle or motorcycle transportation. Passengers are expected to have basic knowledge of using a smartphone, mobile applications, GPS/location services, and the available payment options such as Cash and GCash.

**DRIVER**

A driver is a registered tricycle or motorcycle driver who uses TriGo to receive and manage ride requests. Drivers are expected to have basic knowledge of using a smartphone and mobile applications. Drivers must submit the required information and documents and be verified by an administrator before they can accept bookings.

**ADMINISTRATOR**

An administrator is an authorized user responsible for managing and monitoring the TriGo system. Administrators manage passenger and driver accounts, verify drivers, monitor bookings and system activities, manage tariffs, quotas, commissions, and payment records, and generate system reports. Administrators are expected to have sufficient knowledge of the system's management functions and basic computer or web-based application operations.

	## Constraints

      This section explains the main limitations and conditions that the TriGo Mobile Application needs to follow. It includes the devices and internet connection needed to use the application, the transportation services covered, payment options, location-based services, and other factors that may affect how the system works.

The following constraints apply to the TriGo Mobile Application:

- Device Compatibility: The application is designed to function on supported Android and iOS mobile devices. Differences in device specifications, operating system versions, permissions, and device capabilities may affect the application's performance.

- Internet Connection: An active and stable internet connection is required for core functions such as user authentication, ride booking, booking updates, notifications, payment-related information, and communication with Firebase services.

- Location Services: Location-based functions depend on the availability and accuracy of the user's GPS and location services. Inaccurate or unavailable location information may affect pickup locations, destinations, driver matching, and route information.

- Transportation Coverage: TriGo primarily supports tricycle and motorcycle transportation services within Trinidad, Bohol. Trips outside the municipality may be accommodated only when an available driver is willing to accept the request.

- Out-of-Area Trips: For trips outside Trinidad, the passenger and driver may agree on the applicable fare. The availability of such trips depends on driver availability and willingness to accept the request.

- Driver Availability: The system cannot guarantee that a driver will always be available. Ride requests depend on the number and availability of registered and verified drivers.

- Driver Verification: Drivers must complete the required registration and verification process before they are allowed to accept passenger bookings.

- Payment Options: The system supports Cash and GCash as payment options within the defined project scope. Other digital payment platforms and bank transfer methods are not included unless implemented in a future version.

- GCash Dependency: GCash-related functionality depends on the payment method and integration implemented in the system and on the availability of GCash services.

- Tariff Management: Applicable fare rates depend on the tariff information configured by the administrator. Changes to tariff settings may affect the fares applied by the system.

- Quota Management: Applicable quotas or operational limits depend on the quota settings configured by the administrator.

- Commission Management: Applicable commissions depend on the commission rates and rules configured by the administrator.

- Third-Party Services: The system depends on Firebase and other applicable third-party services. Service interruptions, changes, or limitations from these providers may affect certain system functions.

- Local Transportation Focus: TriGo is primarily designed for local transportation operations in Trinidad, Bohol and is not intended to function as a nationwide transportation booking application.

- User Responsibility: Passengers and drivers are responsible for providing accurate information and following applicable transportation arrangements and rules when using the system.

### 2.4.1. Hard Constraints 

    This section describes the requirements that the Trigo Mobile Application must follow. These include the supported mobile devices, internet connection, transportation coverage within Trinidad, Bohol, driver verification, payment options, and the technologies required to develop and operate the system.

-  The following are the hard constraints of the system:

- Mobile Application: The system must be developed as a mobile application that supports both Android and iOS devices.

- Internet Connection: An active internet connection must be available for important functions such as user registration, login, ride booking, booking updates, notifications, payment-related information, and communication with the system.

- Service Area: The application must primarily support tricycle and motorcycle transportation services within the Municipality of Trinidad, Bohol.

- Out-of-Area Trips: Trips outside Trinidad, Bohol may be accommodated when a registered and verified driver is available and willing to accept the request. The applicable fare may be agreed upon by the passenger and driver.

- Registered and Verified Drivers: Drivers must register and submit the required information and documents. Drivers must be verified by an administrator before they can accept passenger booking requests.

- User Accounts: Users must have a valid registered account to access the booking and management features available to their respective roles.

- Location Services: GPS or location services must be available and enabled when using location-based functions such as selecting pickup locations, destinations, and identifying available drivers.

- Firebase Services: The system must use Firebase services, including Firebase Authentication and Cloud Firestore, for user authentication, data storage, and other applicable backend functions. The system depends on the availability of these services.

- Payment Options: The system must support Cash and GCash as the defined payment options within the project scope.

- Tariff Management: Applicable transportation fares must follow the tariff rates and pricing rules configured by the administrator.

- Quota Management: Applicable quotas or operational limits must follow the quota settings configured by the administrator.

- Commission Management: Applicable service or platform commissions must follow the commission rates and rules configured by the administrator.

- User Information: Passengers and drivers must provide accurate and valid information required for registration, booking, verification, and other system functions.

- Platform and Service Dependency: The application's functionality may be affected by the availability of Firebase, GCash, GPS/location services, internet connectivity, and other third-party services required by the implemented system.

### 2.4.2. Soft Constraints 

 This section describes the conditions that are preferred for the TriGo Mobile Application but may be adjusted or improved during development based on testing, user feedback, and project requirements. These include usability, interface design, information presentation, application performance, and the overall convenience of the system for passengers, drivers, and administrators.

The following are the soft constraints of the system:

- Simple User Interface: The application should provide a simple, clear, and easy-to-understand interface so that passengers, drivers, and administrators can use the system without unnecessary difficulty.

- Convenient Booking Process: The passenger booking process should be kept simple and efficient to allow users to request transportation with minimal steps.

- Clear Information: Booking details, pickup and destination locations, fare information, driver information, payment method, booking status, and ride information should be presented clearly to avoid confusion.

- Easy Payment Selection: The application should provide a straightforward way for passengers to select their preferred payment option, including Cash or GCash, during the applicable booking or payment process.

- User-Friendly Driver Functions: Driver features such as availability management, booking requests, ride status updates, and trip history should be easy to understand and operate.

- Accessible Administrative Functions: Administrative features for managing users, drivers, bookings, tariffs, quotas, commissions, payments, and reports should be organized in a way that allows administrators to efficiently perform their tasks.

- Responsive Design: The application's interface should adapt appropriately to supported Android and iOS mobile devices and different screen sizes.

- Application Performance: The application should respond properly and load its features within a reasonable amount of time when a stable internet connection and required external services are available.

- Readable Notifications: Notifications and system messages should provide clear and understandable information about booking requests, booking status, ride updates, payments, and other important activities.

- Continuous Improvement: The application's interface and features may be improved based on user feedback, testing results, evaluation, and identified usability issues during development.

	## Assumptions and Dependencies

      This section describes the conditions that are expected to be available or working for the TriGo Mobile Application to function properly.

The following assumptions and dependencies apply to the system:

- Compatible Devices: Users are expected to have a supported Android or iOS mobile device capable of running the TriGo application.

- Internet Availability: Users are expected to have a stable internet connection when using online features such as account access, ride booking, booking updates, notifications, payment-related functions, and real-time communication.

- Accurate User Information: Passengers and drivers are expected to provide correct, complete, and updated information during registration and when using the system.

- Driver Availability: The system assumes that registered and verified drivers will accurately update their availability status so passengers can identify drivers who may be able to accept booking requests.

- Driver Verification: The system depends on administrators to review and verify driver applications and submitted documents before drivers are allowed to accept passenger bookings.

- Firebase Availability: The system depends on Firebase services for user authentication, Cloud Firestore data storage, real-time communication, and other applicable backend operations.

- GPS and Location Services: Location-based features depend on the user's device having GPS/location services enabled and available. The accuracy of location information depends on the device and available location services.

- Mapping and Location Services: Fare, route, pickup, destination, and driver-location features may depend on the availability and accuracy of the mapping and location services used by the application.

- GCash Availability: GCash payment functionality depends on the payment method or integration implemented in the system and the availability of GCash services.

- Payment Information: The system assumes that passengers will provide or select the appropriate payment method, such as Cash or GCash, when required.

- Tariff Configuration: The system depends on administrators to maintain accurate tariff rates and pricing rules used by the application.

- Quota Configuration: The system depends on administrators to maintain applicable quota settings and operational limits.

- Commission Configuration: The system depends on administrators to maintain the applicable commission rates and rules used for transportation transactions.

- Driver Participation: The system assumes that registered drivers will actively use the application and respond to booking requests when they are available.

- Third-Party Services: The functionality of the application may depend on the availability of external services such as Firebase, GCash, GPS/location services, mapping services, and internet connectivity.

		# Specific Requirements

      This section provides information about the system features, user requirements, performance, security, and other requirements needed to ensure that the application works properly for commuters, drivers, and administrators.

	## External Interfaces Requirements

		

		     External Interface Requirements specify the hardware and software with which the TriGo Mobile Application must interact. This section provides information to ensure that the application can communicate properly with mobile devices, internet services, Firebase, and other external components needed for the system to function.

		

### 3.1.1. Hardware Interfaces 

		

		            A computer is required for the development, testing, configuration, and administration of the TriGo Mobile Application, while smartphones are used by passengers and drivers to access and use the application.

		

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

		Development Framework: React Native with Expo

		Programming Language: TypeScript / JavaScript

		Database: Cloud Firestore

		Backend Service: Firebase

		Authentication: Firebase Authentication

		Development Tool: Visual Studio Code

		System Diagram Tool: Draw.io

		

		

		

		

		

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

**3.2.2.16. ****Fare Management Prototype**

Figure 25.0 Fare Management Prototype

	## Performance Requirements

       This section describes how well the TriGo application should perform when users access and use its features.

### 3.3.1. Execution Time 

       The system should respond within a reasonable time when users log in, submit bookings, receive updates, and access other features.

### 3.3.2. Efficiency

       The application should use its available resources efficiently and allow passengers, drivers, and administrators to complete their tasks without unnecessary delays.

	## Design Constraints

      This section describes the design requirements and limitations that should be followed when developing the TriGo application.

### 3.4.1. Software Language

      The application will use TypeScript and JavaScript with React Native and Expo for development, while Firebase will be used for backend services and data storage.

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

### 3.5.2. Availability

     The application should be available when the application services and required Firebase services are operational.

An active internet connection is required for:

- Login

- Registration

- Ride booking

- Booking updates

- Notifications

- Database access

### 3.5.3. Security 

     The system should protect user accounts and personal information by using proper authentication, access control, and secure handling of data stored in the application.

### 3.5.4. Maintainability

     The application should be organized and structured in a way that allows the development team to easily identify problems, fix errors, update existing features, and add improvements when needed.

### 3.5.5. Portability

 

      The application should support both Android and iOS devices, allowing commuters and drivers to use its main features across supported mobile platforms without major changes to the system.

|  | Page │ **1** |
| --- | --- |