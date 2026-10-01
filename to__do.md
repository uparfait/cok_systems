# Visitors restructure - Smart Parking and Service Delivery

Status legend: [ ] to do, [x] done.

## Decisions taken (tell me if any should change)

1. Visitor fields are named exactly as requested: identification (id_type + number), full_name, telephone, email,
   gender (Male / Female), Is_In_House, N_visits, plus createdAt / updatedAt.
2. Unique fields: identification number, telephone, email (email stays optional). Values are normalised before the
   check (ID number upper case without spaces, Rwandan phones in the 07XXXXXXXX form, email lower case), so
   "0788 123 456" and "+250788123456" are the same telephone.
3. Required when registering a visitor: ID type, ID number, full name, telephone, gender.
4. A visitor can have only one open (in house) visit at a time. A car check-in for a visitor opens the visit, or
   links the car to the visit that is already open.
5. Staff cars: the driver is stored in Visitors (the car keeps only the reference) but no service-delivery visit is
   opened for staff, so staff do not appear as in-house visitors at reception.
6. Is_In_House = the visitor has an open visit. N_visits goes up by one each time a visit opens (walk-in or car),
   and for each staff car check-in. A car check-in for someone already in house does not count twice.
7. Badge numbers are removed everywhere. "Partial exit" and "Returned" at the gate stay, without badges.
8. Attachments belong to visits (service delivery). They are added to the open visit, or to the latest visit when
   the visitor is not in house. Unlimited files and size; downloads require login.
9. Panel actions by role: employee = Serve, Transfer (and Complete when they are the one serving); every other role
   (receptionist, head of department, gate officer, admin, mayor) = Send to department; everyone = add attachments
   and edit their own attachments; visitor details can be edited only while the visitor is in house.
10. Only one person can serve a visitor at a time; everyone sees who is serving.
11. The employee "Department Queue" link also did nothing (the employee dashboard ignored ?tab=). It will now open
    the department queue. The head of department "Service History" tab works and stays.
12. The overlay close button becomes the circled transparent X icon you asked for (this is the only new icon).
13. "All tables / all overlays / all forms" (sections 9, 10, 11) covers every system EXCEPT DCS and event management,
    which are never touched (your instruction). Their files were restored to how they were before this work.

## 1. Data models (backend)

- [x] 1.1 New `Visitor` model with the fields above, unique indexes, timestamps
- [x] 1.2 `ServiceDelivery` keeps only visit data + `visitor` reference (personal fields and badge removed),
      adds current server, attachments, parking link, one-open-visit rule
- [x] 1.3 `ParkingRecord` keeps only car data + `visitor` reference (driver fields and badge removed), adds visit link,
      no double active record per plate
- [x] 1.4 `FlaggedVehicle` stores `visitor` and parking record references instead of driver details
- [x] 1.5 `ServiceTracking` rows reference the visitor and the visit
- [x] 1.6 Shared visitor helpers: normalise, find conflicts, create or update a visitor, open/close visits,
      parking sessions, serving lock, department scope, response shaping

## 2. Visitor registration rules

- [x] 2.1 Unique check on identification, telephone and email: "Someone with this <field> is already registered (Name)";
      same visitor (same _id) = update instead of error
- [ ] 2.2 Visitor check-in (reception and gate person check-in): look up Visitors, fill the form when found, every
      field editable, changes update that visitor
- [x] 2.3 Receptionist "register visitor" applies the same checks
- [x] 2.4 Visitor checking in with a car: the car and the visit are both recorded (no more forced logout for receptionists)
- [x] 2.5 N_visits counted on every check-in, with or without a vehicle
- [ ] 2.6 Badge number removed from every form, table, model and API

## 3. Vehicle check-in (/checkin-vehicle)

- [x] 3.1 Car checked in as usual, driver details stored only as a visitor reference
- [ ] 3.2 Plate entered: if the car parked before, the last visitor who came with it is filled in, editable
- [x] 3.3 Driver not in the system: added to Visitors first, then linked to the car
- [x] 3.4 Driver type decided by the server (staff registry / reservation / regular)
- [ ] 3.5 Car lists everywhere show the person who came with the car (populated visitor)
- [x] 3.6 Car check-out closes the linked visit (exit time and durations recorded)

## 4. Global visitor panel (opens when a visitor is clicked, all roles, not on check-out pages)

- [x] 4.1 Panel with headers: Info, Add attachment, Attachments
- [x] 4.2 Info: all visitor details, N visits, in house, current visit, who is serving now
- [x] 4.3 Info bottom: Send to department (non-employee roles) / Serve and Transfer (employees), only while in house
- [x] 4.4 Serving lock: when someone serves, nobody else can serve; other actions (attachments) still allowed
- [x] 4.5 Edit visitor details only while in house
- [x] 4.6 Add attachment: any number of files, any size, each with a description
- [x] 4.7 Attachments: list with description and who added it (name, email, telephone, department, time),
      current visit first
- [x] 4.8 Attachment can be updated only by the person who added it
- [ ] 4.9 Every visitor row and name in SD and SP screens opens the panel (except check-out pages)

## 5. Visitors page (one page for every role that has the Visitors link)

- [x] 5.1 Same page for receptionist and employee (remove the visitors / all-visitors contradiction)
- [x] 5.2 Table designed like the Applicant Selection Console table: search and filters inside the column headers,
      only the time filter at the top
- [x] 5.3 In house filter in its header: In house (default) / Not in house / All; in-house visitors first
- [x] 5.4 Sorted by last update (newest first)
- [x] 5.5 "My departments": employee = own department, head of department = whole department and its units
- [x] 5.6 Columns show all visitor details including N visits
- [x] 5.7 Register visitor from the page (with optional car plate)

## 6. Navigation clean-up

- [x] 6.1 Remove the "Assigned Visitors" link and page
- [x] 6.2 Remove employee "Service History" (dashboard?tab=history)
- [x] 6.3 Employee "Department Queue" opens the queue (see decision 11)
- [x] 6.4 Keep the three copies of Default_Roles.json identical

## 7. Admin: legacy data

- [x] 7.1 Admin link "Legacy Data"
- [x] 7.2 Scan smart parking, service delivery and related collections for records in the old structure
- [x] 7.3 Delete them after confirmation, then recalculate parking counters and in-house flags

## 8. Downloads and statistics

- [ ] 8.1 Visitors download built from service delivery visits, each populated with its visitor
- [ ] 8.2 Parking download built from parking records, each populated with its visitor
- [ ] 8.3 All statistics updated to the new structure (gender, visitor counts, in house, queues, dashboards,
      KPIs, performance, mayor and admin views)

## 9. All tables across the system

- [ ] 9.1 Body scrolls horizontally and vertically, header stays fixed, cells do not wrap
- [ ] 9.2 Visitor and parking tables show all visitor details and N visits

## 10. All forms

- [ ] 10.1 Every required field label carries a red *

## 11. All overlays across the system

- [ ] 11.1 Remove the blue header bar
- [ ] 11.2 Close in the header as a circled transparent icon
- [ ] 11.3 Remove Cancel buttons (Close does it)
- [ ] 11.4 Closing is blocked while a process is running

## 12. Server and deployment

- [x] 12.1 Upload size unlimited end to end (backend and nginx)
- [x] 12.2 New realtime events for visitor updates and attachments

## 13. Verification

- [x] 13.1 Backend tests against a real MongoDB engine (registration, conflicts, check-in/out, serving lock,
      attachments, legacy clean-up)
- [ ] 13.2 Frontend type check and production build pass
- [ ] 13.3 Independent review of all changes
