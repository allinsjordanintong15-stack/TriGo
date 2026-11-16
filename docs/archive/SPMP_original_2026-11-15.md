| Software Project Management Plan  TriGo: Transport Booking and Management Mobile Application for Trinidad, Bohol |  |
| --- | --- |

Software Project Management Plan

for

TriGo: Transport Booking and Management Mobile Application for Trinidad, Bohol

# List of Figures 

	**     Figure No.**	**Description **		**   **		**Page**

	**     **Figure 1.0                                 External Structure		            9

	     Figure 2.0                                Internal Structure			  10

	     Figure 3.0                          Feature Breakdown Structure	           12

# List of Tables

**Table No.**				**Description**					**Page**

Table 1.0		      	 Milestone Task						  6

Table  2.0               	 Definition, Acronyms, and Abbreviations		  7

Table 3.0 			Roles and Responsibilities					 11

Table 4.0			Staff and Person Involved in Project			 13

Table 5.0      		Work Plan							 14  

Table 6.0			Work Activities						 20

Table  7.0 		Methods and Techniques					 21

Table 8.0			Tools								 22

		# Overview

**TriGo****: Transport Booking and Management Mobile Application for Trinidad, Bohol** is a mobile-based transportation booking and management system designed to connect passengers with registered tricycle and motorcycle drivers within the Municipality of Trinidad, Bohol.

The application provides passengers with a convenient platform to request and book transportation services, specify pickup and destination locations, view applicable fare information, monitor ride status, receive notifications, and manage their ride history. The system also provides **Cash and ****GCash** as available payment options for completed or applicable transportation transactions.

For drivers, TriGo provides features for registration, profile management, submission of required verification documents, availability management, receiving and responding to ride requests, managing active rides, and viewing completed ride records.

The system also provides an **Administrator** platform for managing passenger and driver accounts, verifying driver applications and documents, monitoring bookings and system activities, and managing transportation-related information. Administrators can configure and manage **tariffs, quotas, and commissions** to support organized and transparent transportation operations.

The primary service area of TriGo is **Trinidad, Bohol**. However, transportation requests to locations outside the municipality may be accommodated when a driver is available and willing to accept the trip. For such trips, the passenger and driver may agree on the fare, subject to the applicable rules and commission settings implemented in the system.

TriGo is developed using **React Native with TypeScript and Expo** for the mobile application, with **Firebase Authentication, Cloud ****Firestore****, and other applicable ****Firebase services** supporting the backend and data management. The application is designed to be functional on both **Android and iOS** devices.

The project aims to improve local transportation services by reducing passenger waiting time, improving communication between passengers and drivers, providing greater fare transparency, and establishing a more organized digital platform for managing local tricycle and motorcycle transportation services.

	## Project Summary

		

			**TriGo****: Transport Booking and Management Mobile Application for Trinidad, Bohol** is a mobile application designed to provide a convenient and organized transportation booking service for passengers and local tricycle and motorcycle drivers in Trinidad, Bohol.

			The system allows **passengers** to register and manage their accounts, specify pickup and destination locations, request and book rides, view applicable fare information, monitor ride status, receive notifications, select available payment options such as **Cash or ****GCash**, and view their ride history.

			For **drivers**, the system provides features for registration, profile management, submission of required personal and vehicle information, document verification, availability management, receiving and responding to ride requests, managing active rides, and viewing completed ride records.

			The system also includes an **Administrator** role responsible for managing passenger and driver accounts, verifying driver applications and submitted documents, monitoring ride and system activities, and maintaining transportation-related information. Administrators can also manage **tariffs, quotas, and commissions** to establish and monitor the operational and financial rules of the transportation service.

			TriGo primarily operates within **Trinidad, Bohol**. However, passengers may request trips to destinations outside the municipality, such as nearby municipalities, provided that an available driver is willing to accept the trip. For these trips, the passenger and driver may agree on the transportation fare, while the applicable system commission may still be considered based on the configured commission rules.

			The application is developed using **React Native with TypeScript and Expo**, with **Firebase Authentication, Cloud ****Firestore****, and applicable Firebase services** supporting authentication, data storage, real-time communication, and other backend functions. TriGo is designed to be functional on both **Android and iOS devices**.

			Overall, the project aims to improve local transportation services by reducing passenger waiting time, improving passenger-driver coordination, promoting fare transparency, supporting convenient payment options, and providing administrators with an organized platform for managing local transportation operations.

		

		**1.1.1. Purpose, Scope and Objectives**

		**Purpose**

			The purpose of TriGo: Transport Booking and Management Mobile Application for Trinidad, Bohol is to provide a convenient, reliable, organized, and transparent digital platform for booking and managing local tricycle and motorcycle transportation services.

			The system is designed to connect passengers with registered and verified drivers, allowing passengers to request transportation through a mobile application instead of manually searching for available drivers. It aims to reduce passenger waiting time, improve communication between passengers and drivers, provide clearer fare information, and support convenient payment options through Cash and GCash.

			TriGo also provides administrators with centralized tools for managing users, drivers, bookings, transportation information, tariffs, quotas, and commissions, helping establish a more organized transportation management process.

		

		**Scope**

			The scope of TriGo covers the development of a mobile transportation booking and management application for tricycle and motorcycle transportation services, primarily within the Municipality of Trinidad, Bohol.

		

		The system consists of three primary user roles:

		**Passenger**

		Passengers can:

		- Register and manage their accounts.

		- Set their pickup and destination locations.

		- View available tricycle and motorcycle drivers.

		- Request and book transportation services.

		- View applicable or estimated fare information.

		- Select available payment options, including Cash and GCash.

		- Monitor the status of their ride.

		- Receive ride-related notifications.

		- View their completed ride history.

		**Driver**

		Drivers can:

		- Register and manage their driver profiles.

		- Submit required personal and vehicle information.

		- Submit required documents for verification.

		- View their verification status.

		- Set and manage their availability.

		- Receive and respond to passenger ride requests.

		- Accept or reject available ride requests.

		- Manage active rides.

		- View completed ride records.

		- View applicable fare and commission information.

		**Administrator**

		Administrators can:

		- Manage passenger accounts.

		- Manage driver accounts.

		- Review and verify driver applications.

		- Review submitted driver and vehicle documents.

		- Monitor ride requests and ride activities.

		- Manage transportation-related information.

		- Configure and manage tariff rates and pricing rules.

		- Configure and monitor applicable quotas.

		- Configure and manage commission rates.

		- Monitor payment and transaction records.

		- Monitor system activities and maintain operational records.

		**Transportation Coverage**

			TriGo primarily supports transportation services within Trinidad, Bohol.

		The system may also accommodate trips to destinations outside Trinidad when a registered and available driver is willing to accept the request. For such trips, the passenger and driver may agree on the fare based on the trip requirements and applicable transportation arrangements. The system may still apply the configured commission rules to the transaction.

		**Payment**

			TriGo supports Cash and GCash as payment options for transportation transactions.The implementation of GCash payment will depend on the payment functionality included in the system. The system will record relevant payment information associated with completed or applicable ride transactions.

		Objectives.The main objective of TriGo is to develop a mobile transportation booking and management application that improves the accessibility, efficiency, coordination, and transparency of local tricycle and motorcycle transportation services in Trinidad, Bohol.

		Specifically, the system aims to:

		

		- Develop a mobile platform that allows passengers to conveniently request and book tricycle and motorcycle transportation services.

		- Reduce passenger waiting time by helping passengers identify and request available drivers through the application.

		- Improve communication and coordination between passengers and drivers through centralized ride requests and real-time ride updates.

		- Provide passengers with clear and accessible fare information before or during the booking process.

		- Provide Cash and GCash as available payment options for transportation transactions.

		- Provide drivers with tools for managing their profiles, verification information, availability, ride requests, active rides, and completed rides.

		- Implement a driver verification process that allows administrators to review and validate driver information and submitted documents.

		- Implement tariff management to allow administrators to configure and maintain applicable transportation fare rates and pricing rules.

		- Implement quota management to allow administrators to establish and monitor applicable operational limits or allocations.

		- Implement commission management to allow administrators to configure and monitor the applicable service or platform commission for transportation transactions.

		- Provide administrators with centralized tools for managing users, drivers, bookings, payments, transportation information, and system activities.

		- Maintain organized records of ride requests, completed rides, fares, payments, commissions, and other relevant transportation activities.

		- Support transportation requests within Trinidad, Bohol while providing a mechanism for handling eligible out-of-area trips based on driver availability and passenger-driver fare agreements.

		- Develop the application to function on both Android and iOS mobile platforms.

		- Provide a secure, reliable, and user-friendly transportation management platform that can support the operational needs of passengers, drivers, and administrators.

		

### 1.1.2. Assumptions and Constraints

TriGo is designed as a **client-server mobile application** that connects passengers with registered and verified tricycle and motorcycle drivers. The system supports transportation booking, ride management, payment recording, and administrative management through cloud-based services.

The system is developed using the following technologies:

- **Mobile Application:** React Native with TypeScript, built using Expo and designed to support **Android and iOS platforms**.

- **Back-end:** Firebase, utilizing Firebase Authentication, Cloud Firestore, and Cloud Functions where applicable.

- **Database:** Cloud Firestore, a NoSQL cloud-hosted database.

- **Cloud Infrastructure:** Firebase services hosted on Google Cloud infrastructure.

- **Programming Languages:** TypeScript and JavaScript.

- **Architecture:** Three-Tier Architecture consisting of:

- **Presentation Layer:** React Native mobile application

- **Logic/Service Layer:** Firebase services and Cloud Functions where applicable

- **Data Layer:** Cloud Firestore

- **Communication Protocol:** HTTPS and Firebase real-time communication services.

- **Service Area:** Primarily focused on Trinidad, Bohol for location-based services, driver matching, and transportation-related features.

- **Payment Options:** Cash and GCash for supported transportation transactions.

**Assumptions**

The following assumptions apply to the development and operation of the TriGo system:

- The system primarily supports transportation services within the **Municipality of Trinidad, Bohol**. Trips outside the municipality may also be accommodated when a registered driver is available and willing to accept the trip.

- Passengers are assumed to have a compatible **Android or iOS mobile device** with an active internet connection to access the application and its cloud-based services.

- Users are assumed to enable **GPS and location services** when using location-based features. The accuracy of pickup, destination, route, and driver-location information depends on the user's device and available location services.

- Passengers are assumed to provide accurate and complete **pickup and destination information** when requesting a ride.

- Drivers are assumed to provide valid and accurate **personal, vehicle, and required verification information** during registration.

- Drivers are assumed to maintain accurate availability information and accept ride requests only when they are available and willing to provide the requested transportation service.

- Drivers must be **registered and verified by the system administrator** before being allowed to accept passenger bookings.

- Administrators are assumed to regularly review and manage **passenger accounts, driver applications, submitted documents, bookings, payments, tariffs, quotas, commissions, and other system activities**.

- Tariff rates, quota settings, and commission rates are assumed to be configured and maintained by authorized administrators according to the operational policies established for the project.

- Passengers and drivers are assumed to follow the agreed transportation arrangements, including the applicable fare and selected payment method.

- GCash payments are assumed to be made using the passenger's valid GCash account and through the payment functionality supported by the implemented system.

- The system is assumed to have access to Firebase services for **authentication, data storage, ride information, notifications, and real-time communication**.

**Constraints**

The following constraints apply to the TriGo system:

- The primary transportation service area is limited to **Trinidad, Bohol**. Trips outside the municipality depend on driver availability and the willingness of a driver to accept the requested trip.

- For eligible out-of-area trips, the final transportation fare may be based on an **agreed amount between the passenger and driver**. The applicable system commission may still be calculated according to the commission settings configured by the administrator.

- The availability and accuracy of location-based features depend on the user's **GPS, mobile device capabilities, internet connection, and available mapping or location services**.

- The system requires an active internet connection for most core functions, including **authentication, ride booking, ride updates, payment-related information, notifications, and synchronization with Firebase services**.

- The availability of drivers is not guaranteed at all times because ride requests depend on the number of **registered, verified, and available drivers**.

- Tariff calculations are dependent on the **tariff rates and pricing rules configured by the administrator**. Changes to these settings may affect applicable fares.

- Quota availability and limitations are dependent on the **quota rules and values configured by the administrator**.

- Commission calculations are dependent on the **commission rates and rules configured by the administrator** and the applicable transportation transaction.

- **Cash and ****GCash** are the supported payment options within the scope of the project. Other digital payment platforms and bank transfer methods are outside the scope unless added in a future version.

- The functionality of GCash payment depends on the payment method and integration implemented in the system. Availability of external GCash services is subject to the policies, requirements, and service availability of GCash.

- The system is designed to be functional on both **Android and iOS platforms**. Differences in device specifications, operating system versions, permissions, GPS capabilities, and other platform-specific factors may affect system performance or user experience.

- The system depends on the availability of **Firebase and other third-party services**. Service interruptions, provider limitations, or changes to third-party services may temporarily affect certain system functions.

- The system is primarily intended for **local transportation operations in Trinidad, Bohol** and is not designed as a nationwide transportation booking platform.

- The system does not guarantee the safety, conduct, or performance of passengers or drivers. Users are responsible for following applicable transportation rules and exercising appropriate care during transportation transactions.

- The project is limited to the features and functionality defined within the approved project scope. Additional transportation services, payment providers, geographic areas, or advanced features may require future system enhancements.

### 1.1.3. Project Deliverables

Upon completion of the project, the development team shall deliver the following:

- Software Project Management Plan (SPMP)

- Software Requirements Specification (SRS)

- Software Design Description (SDD)

- Software Testing Document (STD)

- User Manual

- Source Code

- TriGo Mobile Application

- Administrator Management System

- Database Design Documentation

- System Installation and Configuration Guide

- Final Project Documentation

- User Orientation and Demonstration

### 1.1.4. Schedule and Project Summary

		

				The project will be developed using the Agile Software Development methodology

		with iterative development phases. The schedule below summarizes the major project milestones.

		

| **Milestone Task** | **Date Started** | **Completion Date** |
| --- | --- | --- |
| Project Proposal | July 13, 2026 | July 24, 2026 |
| Requirements Gathering | August 10, 2026 | August 21, 2026 |
| Development Phase I | October 5, 2026 | November 13, 2026 |
| Software Testing I | November 16, 2026 | November 27, 2026 |
| Development Phase II | November 30, 2026 | January 8, 2027 |
| Software Testing II | January 11, 2027 | January 22, 2027 |
| Final Revision | February 20, 2027 | March 12, 2027 |
| Final Deployment | March 13, 2027 | April 2, 2027 |

		

		Table 1.0 Milestone Task

		

		

	## Evolution of Plan

		

				 The Software Project Management Plan shall serve as the official guide for managing the development of TriGo. Any modifications to the project scope, schedule, resources, or deliverables shall be reviewed and approved by the Project Manager before implementation. All approved changes shall be documented to ensure that the project plan remains accurate and up to date throughout the software development lifecycle.

		

	## Definition, Acronyms, and Abbreviations

| **Terms** | **Definition** |
| --- | --- |
| SRS | Software Requirements Specification – a document that describes the system requirements and expected functions |
| SDD | Software Design Description – a document that explains the design and structure of the software system. |
| STD | Software Testing Document – a document containing test cases, procedures, expected results, and actual results. |
| UAT | User Acceptance Testing – testing performed by intended users to determine whether the system meets their needs. |
| UI | User Interface – the visual parts of the application that users interact with. |
| UX | User Experience – the overall experience of users when using the application. |
| TriGo | Is a mobile application that helps users book transportation and travel to their desired destination within Trinidad, Bohol. |
| LGU | Local Government Unit – the local government organization involved in the project and its implementation. |
| GPS | Global Positioning System used to determine geographical location. |
| Firebase | A Google platform that provides backend services such as authentication, database, and cloud functions. |
| API | Application Programming Interface used for communication between the mobile application and the server. |
| CRUD | Create, Read, Update, and Delete – the basic operations used to manage and maintain data in the TriGo system. |
| HTTP | Hypertext Transfer Protocol used for communication between clients and servers. |
| HTTPS | Secure version of HTTP using encryption. |
| Agile | Software development methodology based on iterative development and continuous improvement. |
| Git | A version control system used to track changes in source code. |
| GitHub | An online platform used to store, manage, and collaborate on software source code. |

		

		Table 2.0 Definition, Acronyms, and Abbreviations

		

		

		

		

		

		

		

		

	## References

		

		[1] International Organization for Standardization (ISO). (2018). ISO/IEC/IEEE 29148:2018 – Systems and software engineering — Life cycle processes — Requirements engineering.

		[https://www.iso.org/standard/72089.html](https://www.iso.org/standard/72089.html)

		[2] IEEE Standards Association. (2009). IEEE Standard for Information Technology—Systems Design—Software Design Descriptions (IEEE 1016-2009).

		[https://standards.ieee.org/ieee/1016/4502/](https://standards.ieee.org/ieee/1016/4502/)

		[3] IEEE Standards Association. (2008). IEEE Standard for Software and System Test Documentation (IEEE 829-2008).

		[https://standards.ieee.org/ieee/829/3787/](https://standards.ieee.org/ieee/829/3787/)

		[4] International Software Testing Qualifications Board (ISTQB). (n.d.). Certified Tester Acceptance Testing (CT-AcT).

		[https://www.istqb.org/certifications/certified-tester-acceptance-testing-ct-act/](https://www.istqb.org/certifications/certified-tester-acceptance-testing-ct-act/)

		[5] Nielsen Norman Group. (n.d.). The Definition of User Experience (UX).

		[https://www.nngroup.com/articles/definition-user-experience/](https://www.nngroup.com/articles/definition-user-experience/)

		[6] Nielsen Norman Group. (2025). User-Interface Elements: Glossary.

		[https://www.nngroup.com/articles/user-interface-elements-glossary/](https://www.nngroup.com/articles/user-interface-elements-glossary/)

		[7] U.S. Government. (n.d.). Global Positioning System (GPS).

		[https://www.gps.gov/systems/gps/](https://www.gps.gov/systems/gps/)

		[8] Google. (n.d.). Firebase Documentation.

		[https://firebase.google.com/docs/](https://firebase.google.com/docs/)

		[9] Mozilla Developer Network (MDN). (n.d.). API – Application Programming Interface.

		[https://developer.mozilla.org/en-US/docs/Glossary/API](https://developer.mozilla.org/en-US/docs/Glossary/API)

		[10] Mozilla Developer Network (MDN). (n.d.). HTTP – HyperText Transfer Protocol.

		[https://developer.mozilla.org/en-US/docs/Glossary/HTTP](https://developer.mozilla.org/en-US/docs/Glossary/HTTP)

		[11] Mozilla Developer Network (MDN). (n.d.). HTTPS – HyperText Transfer Protocol Secure.

		[https://developer.mozilla.org/en-US/docs/Glossary/HTTPS](https://developer.mozilla.org/en-US/docs/Glossary/HTTPS)

		[12] Agile Alliance. (n.d.). Manifesto for Agile Software Development.

		[https://agilemanifesto.org/](https://agilemanifesto.org/)

		[13] Chacon, S., & Straub, B. (2014). Pro Git – Getting Started with Git.

		[https://git-scm.com/book/en/v2](https://git-scm.com/book/en/v2)

		[14] GitHub. (n.d.). Learning about GitHub.

		[https://docs.github.com/en/get-started/learning-about-github](https://docs.github.com/en/get-started/learning-about-github)

		[15] Republic of the Philippines. (1991). Republic Act No. 7160 – Local Government Code of 1991.

		[https://lawphil.net/statutes/repacts/ra1991/ra_7160_1991.html](https://lawphil.net/statutes/repacts/ra1991/ra_7160_1991.html)

		[16] TriGo Development Team. (2026). TriGo: Transport Booking and Management Mobile Application for Trinidad, Bohol. Project Definition.

		# Project Organization

This section describes the organizational structure of the TriGo project, including the stakeholders involved, the development team, and the responsibilities of each member. It defines the communication channels and reporting relationships that will be followed throughout the project.

	## External Structure

TriGo is proposed for the Municipality of Trinidad, Bohol, and will be used by commuters, registered tricycle and motorcycle drivers, and the system administrator. The external organizational structure consists of the following stakeholders:

Figure 1.0 External Structure

	## Internal Structure

The TriGo development team follows a streamlined project organization to ensure efficient communication and project execution. The team consists of the following roles:

			   

Figure 2.0 Internal Structure

The Project Manager oversees all project activities and coordinates with the Product Owner. Developers are responsible for implementing system requirements, while the Software Tester ensures that the application meets the required quality standards before deployment.

	## Roles and Responsibilities

       This section of the document describes the role and responsibilities for each member in an agile team that will be involve in project to deliver the Trigo system requirements.

| **Role** | **Responsibilities** |
| --- | --- |
| Product Owner | Defines project requirements, prioritizes features, reviews deliverables, and approves completed work. |
| Project Manager | Plans, monitors, and manages project activities, schedules, risks, and resources. |
| System Analyst | Analyzes user requirements, prepares system specifications, and coordinates with stakeholders. |
| UI/UX Designer | Designs user interfaces and improves the overall user experience of the application. |
| Mobile Application Developer | Develops the Android mobile application and implements application features. |
| Backend Developer | Develops APIs, business logic, authentication, and server-side functionalities. |
| Database Administrator | Designs, maintains, and optimizes the MySQL database. |
| Software Tester | Creates test cases, performs software testing, reports defects, and verifies fixes. |

Table 3.0 Roles and Responsibilities

		# Managerial Process Plans

This section describes the project management processes that will be used during the development of the TriGo Mobile Application. It includes the project start-up plan, work plan, resource management, quality control, risk management, and project monitoring activities.

	## Start-up Plan

		

				The start-up plan defines the activities required before the actual software development begins. These activities include project planning, requirements gathering, resource preparation, schedule estimation, and assigning responsibilities to project team members.

		

### 3.1.1. Estimation Plan 

		

				The TriGo project will adopt the Agile Software Development Methodology because it supports iterative development and allows continuous improvements based on user feedback. The project will be divided into three development iterations consisting of planning, development, testing, and revision. Additional iterations may be conducted if significant changes are requested by the stakeholders.

		

		Figure 3.0 Feature Breakdown Structure

### 3.1.2. Staffing Plan

		

				The project development team consists of members with different responsibilities to ensure the successful completion of the project.

		

| **Name** | **Position** | **Status** |
| --- | --- | --- |
| Local Government Unit of Trinidad | Product Owner | Full-Time |
| Aileen Albaran | Database & Quality Assurance Lead | Full-Time |
| Angel Grace O. Bergantin | Project Manager | Full-Time |
| Allins Jordan C. Intong | Lead Developer | Full-Time |
| Shannia Rey D. Bazar | UI/UX & Documentation Lead | Full-Time |
| Princess Mae S. Palamano | Systems Analyst | Full-Time |

		

		Table 4.0 Staff and Person Involved in Project

		

### 3.1.3. Resource Acquisition Plan

		

				 The development team will utilize available Windows computers, android mobile devices, and, when available, iOS devices for application development and testing. A stable internet connection will be required for accessing Firebase services, downloading development dependencies, testing cloud-based features, and communicating with the development team. Information regarding local transportation operations, commuter concerns, driver practices, fare structures, and other relevant requirements will be gathered through interviews and consultations with commuters, tricycle and motorcycle drivers, and appropriate representatives of the Local Government Unit of Trinidad, Bohol.

		

				The required software and development resources will be prepared before the development phase begins. These resources include Visual Studio Code as the primary code editor, Node.js and npm for managing the React Native and TypeScript development environment, Expo for application development and testing, Android Studio and Android Emulator for Android testing, Git and GitHub for source code management, and Firebase services for authentication, database management, cloud functions, and other backend requirements. Additional resources, such as mapping, location, notification, and payment services, will be acquired or configured as required by the implemented system features.

		

				For iOS preview testing, an iPhone device may be used when available, together with the appropriate Expo and Apple development or distribution services required for testing. The availability of these resources may depend on the development team's equipment, internet connectivity, and project requirements.

		

### 3.1.4. Project Staffing Plan

		

				Before development starts, the project team will review the technologies and tools that will be used in developing the application. Team members will also familiarize themselves with Agile practices, mobile application development, API integration, and database management to ensure efficient project implementation.

		

	## Work Plan

The development of TriGo: Transport Booking and Management Mobile Application for Trinidad, Bohol will be completed through three Agile iterations. Each iteration focuses on specific system features, followed by testing and evaluation before proceeding to the next phase.

| **Project Task** | **Estimated Schedule** |
| --- | --- |
| **1** | **Iteration 1** |
| 1.1 | Requirements Gathering | August 10-21, 2026 |
| 1.2 | System Analysis | October 5-9, 2026 |
| 1.3 | Database Design | October 12-16, 2026 |
| 1.4 | User Interface Design | October 19-23, 2026 |
| 1.5 | User Registration Module | October 26-30, 2026 |
| 1.6 | Driver Registration Module | November 2-13, 2026 |
| 1.7 | Software Testing | November 16-27, 2026 |
| **2** | **Iteration 2** |
| 2.1 | Ride Booking Module | November 30-December 4, 2026 |
| 2.2 | Booking Management | December 7-11, 2026 |
| 2.3 | Driver Availability | December 14-18, 2026 |
| 2.4 | Notifications | December 21-25, 2026 |
| 2.5 | Reports Module | December 28, 2026-January 8, 2027 |
| 2.6 | Software Testing | January 11-22, 2027 |
| **3** | **Iteration 3** |
| 3.1 | System Revisions | February 20-March 5, 2027 |
| 3.2 | Final Software Testing | March 8-12, 2027 |
| 3.3 | Final Deployment Preparation | March 13-April 2, 2027 |

Table 5.0 Work Plan

### 3.2.1. Work Activities

	

The TriGo development project consists of a series of activities that guide the team throughout the development process. Each team member is assigned specific tasks based on their role to ensure that the system is developed efficiently and meets the required objectives.

| **Project ****Task** | **Role** | **Labor**** Hours** |
| --- | --- | --- |
| **1** | **Iteration 1** |
| 1.1 | Requirements Gathering | 18 |
|  | Kick-off Meeting | Project Manager | 2 |
|  | Stakeholder Consultation | Project Manager | 4 |
|  | Requirements Gathering | Project Manager | 6 |
|  | Requirements Documentation | Systems Analyst | 4 |
|  | Requirements Review | Project Manager | 2 |
| 1.2 | System Analysis | 20 |
|  | System Analysis | Systems Analyst | 6 |
|  | Process Analysis | Systems Analyst | 4 |
|  | Functional Requirements Analysis | Systems Analyst | 4 |
|  | System Flow Design | Systems Analyst | 4 |
|  | Analysis Review | Project Manager | 2 |
| 1.3 | Database Design | 20 |
|  | Database Planning | Lead Developer | 3 |
|  | Database Structure Design | Lead Developer | 5 |
|  | Table and Relationship Design | Lead Developer | 5 |
|  | Database Configuration | Lead Developer | 4 |
|  | Database Review | Database & QA Lead | 3 |
| 1.4 | User Interface Design | 20 |
|  | UI Planning | UI/UX & Documentation | 2 |
|  | Wireframe Design | UI/UX & Documentation | 5 |
|  | Passenger Interface Design | UI/UX & Documentation | 5 |
|  | Driver Interface Design | UI/UX & Documentation | 5 |
|  | UI Review | UI/UX & Documentation | 3 |
| 1.5 | User Registration Module | 28 |
|  | Registration Interface Development | Lead Developer | 5 |
|  | Create User Account | Lead Developer | 5 |
|  | Read/View User Information | Lead Developer | 3 |
|  | Update User Information | Lead Developer | 4 |
|  | Delete/Deactivate User Account | Lead Developer | 3 |
|  | Login and Authentication Integration | Lead Developer | 4 |
|  | Module Testing | Database & QA Lead | 4 |
| 1.6 | Driver Registration Module | 30 |
|  | Driver Registration Interface | Lead Developer | 5 |
|  | Create Driver Record | Lead Developer | 4 |
|  | Read/View Driver Information | Lead Developer | 3 |
|  | Update Driver Information | Lead Developer | 4 |
|  | Delete/Deactivate Driver Record | Lead Developer | 3 |
|  | Driver Verification | Lead Developer | 6 |
|  | Module Testing | Database & QA Lead | 5 |
| 1.7 | Software Testing | 25 |
|  | Test Planning | Database & QA Lead | 2 |
|  | User Registration Testing | Database & QA Lead | 4 |
|  | Driver Registration Testing | Database & QA Lead | 4 |
|  | CRUD Testing | Database & QA Lead | 6 |
|  | Bug Documentation | Database & QA Lead | 3 |
|  | Approval | Project Manager | 2 |
| **2** | **Iteration 2** |
| 2.1 | Ride Booking Module | 43 |
|  | Kick-off Meeting | Project Manger | 2 |
|  | Requirements Gathering | Project Manger | 6 |
|  | Database Design | Lead Developer | 5 |
|  | User Interface Design | UI/UX Documentation | 7 |
|  | Create Booking | Lead Developer | 5 |
|  | Read/View Booking | Lead Developer | 3 |
|  | Update Booking Information/Status | Lead Developer | 5 |
|  | Cancel Booking | Lead Developer | 3 |
|  | Module Testing | Database & QA Lead | 7 |
| 2.2 | Booking Management | 38 |
|  | Kick-off Meeting | Project Manger | 2 |
|  | Requirements Gathering | Project Manger | 5 |
|  | Database Design | Lead Developer | 4 |
|  | User Interface Design | UI/UX & Documentation | 6 |
|  | Create Booking Request Record | Lead Developer | 3 |
|  | View Booking Status | Lead Developer | 3 |
|  | Update Booking Status | Lead Developer | 5 |
|  | Accept/Reject Booking Request | Lead Developer | 4 |
|  | Module Testing | Database & QA Lead | 6 |
| 2.3 | Driver Availability | 28 |
|  | Kick-off Meeting | Project Manger | 1 |
|  | Requirements Gathering | Project Manger | 4 |
|  | Database Design | Lead Developer | 3 |
|  | User Interface Design | UI/UX & Documentation | 5 |
|  | Create Availability Record | Lead Developer | 3 |
|  | Read/View Driver Availability | Lead Developer | 2 |
|  | Update Availability Status | Lead Developer | 4 |
|  | Remove/Deactivate Availability | Lead Developer | 2 |
|  | Module Testing | Database & QA Lead | 4 |
| 2.4 | Notifications | 27 |
|  | Kick-off Meeting | Project Manger | 1 |
|  | Requirements Gathering | Project Manger | 4 |
|  | Database Design | Lead Developer | 4 |
|  | User Interface Design | UI/UX & Documentation | 5 |
|  | Create Notification | Lead Developer | 4 |
|  | Read/View Notification | Lead Developer | 3 |
|  | Update Notification/Mark as Read | Lead Developer | 2 |
|  | Delete Notification | Lead Developer | 1 |
|  | Module Testing | Database & QA Lead | 3 |
| 2.5 | Reports Module | 24 |
|  | Reports Interface | UI/UX & Documentation | 2 |
|  | Report Data Retrieval | Lead Developer | 4 |
|  | Generate Booking Reports | Lead Developer | 5 |
|  | Generate User/Driver Reports | Lead Developer | 5 |
|  | View Reports | Lead Developer | 4 |
|  | Report Testing | Database & QA Lead | 4 |
| 2.6 | Software Testing | 37 |
|  | Test Planning | Database & QA Lead | 2 |
|  | Ride Booking | Database & QA Lead | 5 |
|  | Booking Management Testing | Database & QA Lead | 5 |
|  | Driver Availability Testing | Database & QA Lead | 5 |
|  | Notification Testing | Database & QA Lead | 5 |
|  | Reports testing | Database & QA Lead | 5 |
|  | CRUD Testing | Database & QA Lead | 4 |
|  | Bug Fix Verification | Database & QA Lead | 4 |
|  | Approval | Project Manager | 2 |
| **3** | **Iteration 3** |
| 3.1 | System Revisions | 39 |
|  | Kick-off Meeting | Project Manager | 2 |
|  | Review of Iteration 1 and 2 Results | System Analyst | 4 |
|  | Identify System Issues | System Analyst | 3 |
|  | System Revision | Lead Developer | 10 |
|  | CRUD Function Revision | Lead Developer | 6 |
|  | Integration of Modules | Lead Developer | 8 |
|  | Revision Testing | Database & QA Lead | 6 |
| 3.2 | Final Software Testing | 40 |
|  | Final Test Planning | Database & QA Lead | 2 |
|  | Functional Testing | Database & QA Lead | 6 |
|  | Final CRUD Testing | Database & QA Lead | 8 |
|  | Integration Testing | Database & QA Lead | 6 |
|  | User Acceptance testing | Database & QA Lead | 8 |
|  | Bug Fix Verification | Database & QA Lead | 6 |
|  | Final Approval | Project Manager | 4 |
| 3.3 | Final Deployment Preparation | 23 |
|  | Final System Review | Project Manager | 2 |
|  | Final Database Preparation | Lead Developer | 4 |
|  | Final Application Build | Lead Developer | 5 |
|  | Deployment Configuration | Lead Developer | 4 |
|  | User/Administrator Preparation | System Analyst | 3 |
|  | Deployment Documentation | UI/UX & Documentation | 3 |
|  | Deployment Approval | Project Manager | 2 |

Table 6.0 Work Activities

### 3.2.2. Schedule Allocation 

The project will be completed within three Agile iterations. Each iteration includes planning, development, testing, and evaluation. The schedule may be adjusted depending on stakeholder feedback and additional feature requests.

### 3.2.3. Resource Allocation 

The project team will utilize available computers, Android smartphones, internet access, development software, and cloud storage throughout the development period. Human resources will be assigned according to each member's specialization and responsibilities.

### 3.2.4. Budget Allocation 

No external funding is allocated for the development of TriGo. The project team will use available institutional facilities, personal equipment, and free software development tools whenever possible.

	## Control Plan

The control plan ensures that the project remains on schedule, meets quality standards, and satisfies user requirements throughout the software development process.

### 3.3.1. Requirements Control Plan 

System requirements will be documented in the Software Requirements Specification (SRS). Any requested changes shall be evaluated by the Project Manager before implementation to prevent unnecessary scope changes.

		

### 3.3.2. Schedule Control Plan

Weekly progress meetings will be conducted to monitor development progress. The Project Manager will evaluate completed tasks and identify any delays or issues affecting the project schedule.

### 3.3.3. Budget Control Plan

Since no project budget has been allocated, the development team will utilize existing resources efficiently while minimizing unnecessary expenses.

### 3.3.4. Quality Control Plan

Software quality will be evaluated through unit testing, integration testing, system testing, and user acceptance testing. All identified defects will be documented and corrected before deployment.

### 3.3.5. Reporting Plan 

Progress reports will be prepared at the end of each development iteration. These reports will summarize completed tasks, pending activities, identified issues, and planned improvements.

### 3.3.6. Metrics Collection Plan

Project performance will be monitored using task completion rate, defect reports, testing results, and milestone completion. These metrics will help evaluate the project’s progress and quality.

### 3.3.7. Risk Management Plan 

Potential project risks include unstable internet connectivity, changes in user requirements, technical difficulties, delayed feedback from stakeholders, and software defects. The project team will identify, monitor, and implement mitigation strategies throughout the development process.

### 3.3.8. Project Closeout Plan

The project will be considered complete after successful software testing, user acceptance, submission of project documentation, and deployment of the TriGo application. Final project evaluation and turnover will be conducted with the stakeholders.

		# Technical Process Plans

This section describes the software development methodology, technical approaches, development tools, and product acceptance procedures that will be followed during the implementation of the TriGo Mobile Application.

	## Process Model

The TriGo project will use the Agile Software Development Methodology, which supports iterative development and continuous user feedback. The project will be divided into multiple iterations, allowing the development team to implement features gradually while accommodating changes requested by stakeholders. Daily communication, sprint planning, software testing, and sprint reviews will be conducted throughout the development process.

	## Methods, Tools, and Technique

| **Category ** | **Methods and Techniques** |
| --- | --- |
| Requirements Gathering | Interviews, Observation, Brainstorming |
| Requirements Analysis | Use Cases, UML Diagrams |
| System Design | Entity Relationship Diagram (ERD), Three-Tier Architecture |
| Development | Agile Development, Iterative Programming |
| Testing | Unit Testing, Integration Testing, System Testing, User Acceptance Testing |
| Documentation | Microsoft Word, Draw.io, Visual Paradigm |

Table 7.0 Methods and Techniques

| **Category ** | **Tools** |
| --- | --- |
| Operating System | Windows 10/11 |
| Programming Language | TypeScript, JavaScript |
| Mobile Development | React Native, Expo |
| Backend Framework | Firebase |
| Database | Cloud Firestore |
| IDE | Visual Studio Code |
| Version Control | Git and GitHub |
| Database Tool | Firebase Console |
| Documentation | Microsoft Word |
| Diagramming Tool | Draw.io / Visual Paradigm |

Table 8.0 Tools Category

	## Infrastructure Plan

The development team will use personal computers, Android mobile devices, internet connectivity, and a centralized database server during software development. The system will operate using a client-server architecture where mobile devices communicate with the web server through secure HTTP/HTTPS connections.

	## Product Acceptance Plan

The TriGo Mobile Application will undergo User Acceptance Testing (UAT) with representatives from the Local Government Unit, registered drivers, and selected commuters. The project will be considered accepted once all agreed functional requirements have been successfully implemented, tested, documented.

		# Supporting Process Plans

This section describes the supporting processes that will be implemented throughout the development of the TriGo: Transport Booking and Management Mobile Application for Trinidad, Bohol. These processes ensure that the project meets the required quality standards, maintains proper documentation, verifies system functionality, and provides effective solutions to issues encountered during development. The plans include verification and validation, documentation, quality assurance, and problem resolution.

## Verification and Validation Plan

Verification and validation activities will be conducted throughout the software development life cycle to ensure that the TriGo application satisfies both the system requirements and user expectations. Verification will focus on confirming that each development phase produces the intended outputs according to the Software Requirements Specification (SRS), while validation will determine whether the completed application meets the needs of commuters, drivers, and system administrators.

The development team will prepare a separate Software Testing Document (STD) that contains detailed test cases, test procedures, expected results, and actual results. The application will undergo unit testing, integration testing, system testing, and user acceptance testing before deployment.

## Documentation Plan

Proper documentation will be maintained throughout the project to ensure that all project activities, system requirements, and development outputs are well organized and easily accessible. The Project Manager shall ensure that all project documents are updated whenever revisions or changes are approved.

The following documents will be prepared and maintained during the project:

- Software Project Management Plan (SPMP)

- Software Requirements Specification (SRS)

- Software Design Description (SDD)

- Software Testing Document (STD)

- Database Design Documentation

- User Manual

- Installation and Configuration Guide

- Technical Documentation

- Final Project Documentation

All project documents will be stored securely and managed using version control to ensure consistency and accuracy.

## Quality Assurance Plan

Quality assurance activities will be performed throughout the project to ensure that the TriGo application complies with the specified functional and non-functional requirements. The Software Tester will conduct software testing during every development iteration to identify defects and verify that implemented features perform as expected.

The development team will conduct regular code reviews, testing, and evaluation of completed modules before integrating them into the system. Any identified issues will be documented, corrected, and retested before deployment. User feedback obtained during testing will also be considered to improve the quality and usability of the application.

## Problem Resolution Plan

Any issues or problems encountered during software development shall be reported immediately to the Project Manager. Problems will be analyzed, documented, and prioritized according to their impact on the project.

The development team will discuss major issues during scheduled project meetings to determine the most appropriate solution. Corrective actions shall be assigned to the responsible team members, and all resolved issues will be verified through testing before implementation. This process ensures that problems are addressed promptly while minimizing their impact on the project schedule and overall software quality.

Page | 1