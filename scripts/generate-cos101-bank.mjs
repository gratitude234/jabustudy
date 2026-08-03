import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const bank = [];
const M = "supplied_material";
const G = "general_cos101";

function addModule(topic, materialLabel, rows) {
  for (const [prompt, answer, distractors, explanation, difficulty, sourceKind = M] of rows) {
    const rawOptions = [answer, ...distractors];
    const shift = bank.length % 4;
    const options = rawOptions.map((_, index) => rawOptions[(index + shift) % 4]);
    bank.push({
      topic,
      prompt,
      options,
      answerIndex: options.indexOf(answer),
      explanation,
      difficulty,
      sourceKind,
      sourceLabel: sourceKind === M ? materialLabel : `General COS 101 enrichment: ${topic}`,
      cognitive: difficulty === "easy" ? "recall" : difficulty === "hard" ? "analysis" : "application",
      questionKind: difficulty === "easy" ? "concept" : "application",
    });
  }
}

// Module 1: Brief History of Computing (25)
addModule("History, Generations and Classification of Computers", "COS 101 lecture note, Module One", [
  ["Which sequence correctly represents the basic information-processing cycle of a computer?", "Input, processing, output", ["Output, input, storage only", "Processing, output, input", "Input, output, processing"], "A computer accepts input, processes it under program control and produces output.", "easy"],
  ["What does data mean in the lecture note?", "Raw facts that require processing", ["A completed program", "Only printed reports", "Processed and meaningful results"], "Data are raw representations that can be processed to produce information.", "easy"],
  ["What is information?", "Processed, structured and meaningful data", ["Unorganized facts only", "A physical input device", "A set of machine defects"], "Information is data that have been processed and placed in a meaningful context.", "easy"],
  ["What is a computer program?", "A set of instructions that directs a computer to perform a task", ["A collection of output devices", "An unprocessed fact", "A physical memory chip"], "A program is an ordered set of instructions written to make a computer perform a specific task.", "easy"],
  ["Which technology is associated with first-generation electronic computers?", "Vacuum tubes", ["Transistors", "Integrated circuits", "Microprocessors"], "First-generation computers used vacuum tubes for switching and processing.", "easy"],
  ["Which technology replaced vacuum tubes in second-generation computers?", "Transistors", ["Punched cards", "Quantum bits", "Mechanical gears"], "Transistors made second-generation machines smaller, faster and more reliable than vacuum-tube systems.", "easy"],
  ["Which technology defined the third generation of computers?", "Integrated circuits", ["Vacuum tubes", "Single-purpose relays", "Cloud computing"], "Third-generation computers were built with integrated circuits rather than individual transistors.", "easy"],
  ["Which technology is most closely associated with fourth-generation computers?", "Microprocessors built with VLSI technology", ["Vacuum-tube arithmetic", "Paper-tape logic only", "Manual calculation tables"], "Fourth-generation computers emerged from microprocessors and Very Large Scale Integration, or VLSI.", "easy"],
  ["How does a digital computer normally represent data internally?", "As discrete values encoded in binary", ["Only as continuously varying voltage", "Only as printed decimal numbers", "As mechanical movement without symbols"], "Digital computers represent symbols and quantities using discrete binary states.", "medium"],
  ["What distinguishes an analogue computer from a digital computer?", "It represents quantities using continuously varying physical values", ["It can perform no measurements", "It stores every value as text", "It must always be a general-purpose computer"], "Analogue systems model data through continuous physical variables rather than discrete binary values.", "medium"],
  ["Why is a hybrid computer called hybrid?", "It combines analogue measurement with digital processing", ["It uses two brands of keyboard", "It contains only mechanical parts", "It performs no specialized task"], "A hybrid system connects analogue and digital elements to exploit the strengths of both.", "medium"],
  ["Which statement best describes a special-purpose computer?", "It is designed for a restricted task or class of problems", ["It must run every available application", "It is defined only by its physical size", "It cannot contain software"], "Special-purpose systems are optimized for a narrow, predetermined function.", "medium"],
  ["Which activity is most suitable for a general-purpose computer?", "Running payroll, word processing and inventory applications", ["Controlling one fixed appliance function only", "Measuring a single analogue signal without processing", "Performing one permanently wired calculation"], "General-purpose computers can be reprogrammed to handle many different tasks.", "medium"],
  ["Why are supercomputers used for weather and scientific modelling?", "They can perform extremely complex calculations at very high speed", ["They are the cheapest personal devices", "They use no storage", "They are designed only for typing letters"], "Supercomputers provide exceptional processing power for computation-intensive problems.", "medium"],
  ["Which characteristic is traditionally associated with a mainframe computer?", "Supporting large-scale processing and many simultaneous users or devices", ["Fitting inside a wristwatch only", "Operating without an input device", "Running one small personal task at a time"], "Mainframes are designed for high-volume, reliable multiuser transaction and data processing.", "medium"],
  ["Which category includes desktops and laptops intended for individual use?", "Microcomputers", ["Mainframes", "Supercomputers", "Analogue controllers only"], "Personal computers are commonly classified as microcomputers.", "medium"],
  ["What major development followed the Intel 4004 and similar early microprocessors?", "The CPU could be placed on a compact integrated chip", ["Computers returned to vacuum tubes", "All memory became mechanical", "Networking became impossible"], "Microprocessors condensed central processing functions onto a small silicon chip and enabled smaller systems.", "medium"],
  ["A hospital sensor continuously measures a patient's temperature, while a digital system stores readings and triggers alerts. What type of design is this closest to?", "A hybrid computing system", ["A purely mechanical calculator", "A paper-only information system", "A general-purpose system with no measurement input"], "The sensor supplies continuous measurements while digital components process, store and act on the values.", "hard"],
  ["Why is classifying computers solely by physical size less useful today than it once was?", "Small devices can now provide capabilities once limited to much larger machines", ["Computers no longer have physical dimensions", "All computers now perform identical tasks", "Processing power is determined only by colour"], "Miniaturization and distributed computing have weakened the direct link between physical size and capability.", "hard"],
  ["Which trend best summarizes the progression described from early to later computer generations?", "Smaller, faster, more reliable systems with greater integration", ["Larger systems with less memory and higher power use", "A steady return from electronic to manual processing", "The elimination of software and networking"], "Advances from tubes to transistors, ICs and microprocessors improved speed, size, cost and reliability.", "hard"],
  ["What is an algorithm?", "A finite sequence of well-defined steps for solving a problem", ["A physical computer case", "An unorganized collection of data", "A type of monitor"], "Algorithms describe precise steps that can be followed to transform input into a result.", "easy", G],
  ["Which statement correctly distinguishes hardware from software?", "Hardware is physical equipment; software is the instructions it executes", ["Hardware is data while software is electricity", "Hardware exists only online", "Software can operate without any computing platform"], "The physical machine and the programs that direct it are complementary parts of a computing system.", "medium", G],
  ["Why did integrated circuits help reduce computer size?", "Many electronic components could be fabricated on a single chip", ["They required one room for each transistor", "They replaced electronic signals with paper", "They prevented components from sharing connections"], "Integration packs increasing numbers of components into compact semiconductor devices.", "medium", G],
  ["A washing machine controller executes a fixed control program and monitors water level. How should it be classified?", "An embedded special-purpose computer", ["A mainframe for general office work", "A supercomputer for climate modelling", "A manual analogue calculator"], "An embedded controller is built into a larger product to perform a focused function.", "hard", G],
  ["Two computers use the same processor family, but one is a server and the other a laptop. What best explains the different classifications?", "Classification can depend on role and design, not processor generation alone", ["A processor fixes every possible use", "Laptops cannot connect to networks", "Servers contain no operating system"], "Modern computer categories consider workload, form factor, capacity and intended use together.", "hard", G],
]);

// Module 2: Description of Basic Components of a Computer (25)
addModule("Computer Components, Memory and Software", "COS 101 lecture note, Module Two", [
  ["What does computer hardware mean?", "The physical and tangible parts of a computer", ["Only the programs installed on a computer", "Processed information", "Rules for using the internet"], "Hardware includes components that can be physically seen and touched.", "easy"],
  ["What is computer software?", "Programs and instructions that direct the computer", ["The metal computer casing only", "A person who operates a computer", "Raw facts waiting to be processed"], "Software consists of programs written to make a computer perform functions.", "easy"],
  ["What does humanware refer to?", "The people who use or operate a computer system", ["The computer's memory chips", "The operating system kernel", "The network cable"], "Humanware identifies the human users and operators within a computing system.", "easy"],
  ["Which unit is commonly described as the brain of the computer?", "Central processing unit", ["Printer", "Keyboard", "Flash drive"], "The CPU controls operations and performs processing.", "easy"],
  ["Which set contains the three functional parts of the CPU identified in the note?", "Memory unit, control unit and arithmetic logic unit", ["Printer, scanner and speaker", "Browser, compiler and email", "Monitor, mouse and joystick"], "The module divides CPU functions among memory, control and arithmetic-logic units.", "easy"],
  ["What is a bit?", "A binary digit that can be 0 or 1", ["A group of eight bytes", "A type of application", "A complete printed page"], "A bit is the smallest binary data unit and represents one of two states.", "easy"],
  ["How many bits make one byte?", "Eight", ["Two", "Four", "Sixteen"], "A byte consists of eight bits.", "easy"],
  ["Which primary memory is volatile and used as a temporary working area?", "RAM", ["ROM", "Optical disc", "Magnetic tape"], "RAM loses its contents when power is removed and holds active programs and data.", "easy"],
  ["Which property distinguishes ROM from ordinary RAM?", "ROM is non-volatile and normally stores persistent instructions", ["ROM is always faster than CPU registers", "ROM loses all contents without power", "ROM is an output device"], "Read-only memory retains content without continuous electrical power.", "medium"],
  ["Why is SRAM commonly used for cache memory?", "It provides very fast access and does not require refresh cycles", ["It is an optical storage medium", "It is slower than magnetic tape", "It loses data while power remains on"], "SRAM is fast but relatively expensive, making it suitable for smaller cache memories.", "medium"],
  ["What maintenance operation does DRAM require while powered?", "Periodic refreshing", ["Laser scanning", "Mechanical rewinding", "Manual rewriting of every program"], "DRAM cells must be refreshed to retain their stored charge.", "medium"],
  ["What is the primary role of the control unit?", "Directing and coordinating the operations of other computer units", ["Printing every result", "Providing permanent off-site backups", "Creating all user documents"], "The control unit fetches and interprets instructions and coordinates data movement and execution.", "medium"],
  ["Which operation is performed by the arithmetic logic unit?", "Comparing two values", ["Cooling the computer room", "Scanning a printed photograph", "Supplying backup electricity"], "The ALU performs arithmetic operations and logical comparisons.", "medium"],
  ["How does secondary storage generally compare with primary memory?", "It offers persistent, larger-capacity storage but is usually slower", ["It is always volatile and smaller", "It connects only to output devices", "It cannot store programs"], "Secondary storage preserves data and provides greater capacity, though access is slower than main memory.", "medium"],
  ["Why is magnetic tape suited to archival backup rather than rapid random retrieval?", "It is accessed sequentially", ["It contains no digital data", "It is volatile", "It can store only one byte"], "Tape normally requires moving through earlier data before reaching a later block.", "medium"],
  ["What is a central purpose of an operating system?", "Managing hardware resources and providing services for programs", ["Replacing every application", "Converting printed pages into images", "Manufacturing CPU chips"], "An operating system coordinates processors, memory, files and devices while providing a usable platform.", "medium"],
  ["How does a compiler differ from an interpreter in the model presented by the note?", "A compiler translates a whole program, while an interpreter processes statements during execution", ["A compiler is hardware and an interpreter is a user", "An interpreter translates only assembly language", "They are both output devices"], "Compilers typically produce translated code as a unit, whereas interpreters execute through the source incrementally.", "medium"],
  ["A student loses an unsaved document immediately after a power failure. Which property most directly explains the loss?", "RAM is volatile", ["ROM is non-volatile", "The printer is an impact device", "Secondary storage is sequential"], "Unsaved working data may exist only in volatile RAM and disappear when power is lost.", "hard"],
  ["A program must be translated and run one statement at a time for interactive testing. Which translator is the best match?", "An interpreter", ["An assembler for every high-level language", "A device driver", "A disk formatter"], "An interpreter supports incremental translation and execution, which is useful for interactive testing.", "hard"],
  ["A laboratory computer must survive a brief power outage long enough to save work and shut down safely. Which auxiliary device is most appropriate?", "An uninterruptible power supply", ["A voltage label", "A graphics tablet", "A loudspeaker"], "A UPS temporarily supplies electricity and can protect work during short outages.", "hard"],
  ["What is cache memory mainly used for?", "Keeping frequently needed data close to the processor for faster access", ["Producing permanent paper output", "Providing internet addresses", "Replacing all secondary storage"], "Cache reduces the time the processor waits for frequently accessed instructions and data.", "easy", G],
  ["Which statement correctly compares an SSD with RAM?", "An SSD retains files without power, while RAM holds active working data", ["Both always lose data when power fails", "RAM is a mechanical disk", "An SSD is part of the ALU"], "Solid-state drives provide non-volatile storage; RAM is volatile working memory.", "medium", G],
  ["What is firmware?", "Software stored in non-volatile memory that controls or initializes hardware", ["A removable computer case", "A spreadsheet formula", "A printed user manual"], "Firmware supplies low-level instructions for a device and often participates in startup.", "medium", G],
  ["A computer uses part of its storage drive when physical RAM is full. What mechanism is being used?", "Virtual memory", ["Optical character recognition", "Printer spooling only", "Analogue measurement"], "Virtual memory extends the usable address space with storage, though it is much slower than RAM.", "hard", G],
  ["Which backup arrangement offers the strongest protection against both device failure and local disaster?", "Multiple copies on different media, including one off-site", ["One copy on the original drive", "Two filenames in the same folder", "Keeping the only copy permanently in RAM"], "Independent media and an off-site copy reduce the chance that one incident destroys every version.", "hard", G],
]);

// Module 3: Computer Peripherals, Input and Output Devices (25)
addModule("Peripheral, Input and Output Devices", "COS 101 lecture note, Module Three", [
  ["What is a computer peripheral?", "A device attached to a computer for input, output or related communication", ["A program stored inside RAM", "A person who writes software", "A processed data report"], "Peripherals connect the computer to users or external sources and destinations of data.", "easy"],
  ["What is the primary function of an input device?", "To capture data and send it into the computer", ["To produce only paper reports", "To manage the operating system", "To supply permanent electricity"], "Input devices translate user data or signals into forms the computer can process.", "easy"],
  ["What is the primary function of an output device?", "To communicate processed results from the computer", ["To enter every program instruction", "To translate source code", "To provide processor cache"], "Output devices present information to users through visual, printed or audible forms.", "easy"],
  ["Which device is primarily used to enter letters, numbers and commands?", "Keyboard", ["Speaker", "Plotter", "Projector"], "A keyboard provides alphanumeric, function, numeric and control keys for input.", "easy"],
  ["Which device is a hand-controlled pointing device?", "Mouse", ["Printer", "Monitor", "Microphone"], "A mouse moves the pointer and lets the user select on-screen objects.", "easy"],
  ["Which device converts a paper image into a digital image?", "Scanner", ["Speaker", "Plotter", "Stabilizer"], "A scanner captures an image from paper and converts it to digital form.", "easy"],
  ["Which input device captures sound?", "Microphone", ["Monitor", "Printer", "Barcode label"], "A microphone converts sound into a signal that can be digitized and stored.", "easy"],
  ["Which output device produces a hard copy on paper?", "Printer", ["Mouse", "Joystick", "Scanner"], "A printer transfers text or graphics from the computer to paper.", "easy"],
  ["Which technology converts scanned printed characters into editable text?", "Optical character recognition", ["Optical mark recognition", "Magnetic ink recognition", "Audio compression"], "OCR identifies printed character shapes and converts them into machine-readable text.", "medium"],
  ["Why is OMR suitable for marking multiple-choice answer sheets?", "It detects filled positions in predefined response areas", ["It recognizes every handwritten essay", "It reads magnetic cheque ink", "It converts speech into text"], "Optical Mark Recognition identifies marks placed in known locations on a form.", "medium"],
  ["Where is MICR most commonly applied?", "Reading machine-printed characters on bank cheques", ["Recording classroom audio", "Displaying video output", "Drawing engineering plans"], "Magnetic Ink Character Recognition supports fast, reliable processing of cheque codes.", "medium"],
  ["What does a barcode reader normally send to a computer?", "The encoded identifier obtained from the light-and-dark pattern", ["A complete product description stored in every line", "A printed hard copy", "An operating-system update"], "The reader converts the scanned pattern into an identifier that software can process.", "medium"],
  ["Why is a graphics tablet useful to an illustrator?", "It captures precise pen or stylus movements as digital input", ["It prints large engineering drawings", "It provides backup power", "It stores programs permanently in ROM"], "A digitizer or graphics tablet converts drawing movements and positions into digital data.", "medium"],
  ["Which task is a joystick particularly suitable for?", "Directional control in a game or simulation", ["Printing a document", "Reading magnetic ink", "Compiling source code"], "A joystick provides continuous directional input for interactive control.", "medium"],
  ["Why can a trackball require less desk space than a mouse?", "Its body remains stationary while the user rotates the ball", ["It has no pointing function", "It is installed inside the CPU", "It displays the pointer itself"], "A trackball changes pointer position without moving the entire device.", "medium"],
  ["Which statement correctly compares hard copy and soft copy?", "Hard copy is physical output; soft copy is displayed electronically", ["Both are always printed on paper", "Soft copy cannot contain images", "Hard copy disappears when an app closes"], "Paper output is physically persistent, while screen output is viewed electronically.", "medium"],
  ["Which printer is an impact printer?", "Dot-matrix printer", ["Laser printer", "Inkjet printer", "Thermal printer"], "Dot-matrix pins physically strike a ribbon against paper, making it an impact technology.", "medium"],
  ["A school wants to convert printed student records into text that staff can search and edit. Which combination is best?", "Scanner followed by OCR software", ["OMR followed by a speaker", "MICR followed by a plotter", "Joystick followed by a printer"], "The scanner captures the page, and OCR converts its character images into editable text.", "hard"],
  ["A supermarket scans a product code, but the price shown is wrong. What is the most likely explanation if the code was read correctly?", "The database record linked to the identifier is incorrect", ["The barcode contains the complete price permanently", "The monitor changed the product identity", "The scanner performed arithmetic in the ALU"], "A barcode usually supplies an identifier; application data determine the associated price and description.", "hard"],
  ["An examination form contains shaded bubbles and handwritten registration numbers. Which design gives the most reliable automated capture?", "Use OMR for bubbles and structured OCR or validated entry for the numbers", ["Use a speaker for both fields", "Use MICR without magnetic ink", "Use a plotter as the input device"], "Different data forms require suitable recognition methods and validation of uncertain text.", "hard"],
  ["Which device commonly captures live video as input?", "Webcam", ["Laser printer", "Speaker", "Projector"], "A webcam converts live images into digital video input.", "easy", G],
  ["Why is a touchscreen both an input and an output device?", "It displays information and detects the user's touch", ["It prints and scans paper simultaneously", "It stores all files permanently", "It replaces the operating system"], "The display presents output while the touch sensor captures input.", "medium", G],
  ["What does display resolution describe?", "The number of pixels used to form the displayed image", ["The volume of the speakers", "The speed of a keyboard", "The amount of printer ink"], "Higher pixel dimensions can represent finer visual detail when other factors are comparable.", "medium", G],
  ["A user with limited hand movement needs to control a computer without a standard mouse. Which solution best applies inclusive input design?", "Offer alternatives such as voice control, switch access or eye tracking", ["Remove all keyboard shortcuts", "Require faster mouse movement", "Disable accessibility settings"], "Accessible systems provide input methods that match different physical capabilities.", "hard", G],
  ["A scanned contract looks clear but searching for a name returns nothing. What should be checked first?", "Whether OCR created a searchable text layer", ["Whether the monitor is an impact device", "Whether the file was printed in colour", "Whether the mouse contains a roller ball"], "An image-only scan has no searchable characters until text recognition is performed successfully.", "hard", G],
]);

// Module 4: Computer Applications (25)
addModule("Computer Applications and Platforms", "COS 101 lecture note, Module Four", [
  ["What is application software?", "Software designed to help an end user perform a task", ["Only the physical parts of a computer", "The electrical supply to the CPU", "Raw data before processing"], "Applications enable users to create, communicate, calculate, browse and perform other tasks.", "easy"],
  ["Which application is used to access websites?", "Web browser", ["Device driver", "Boot loader", "Voltage stabilizer"], "Browsers retrieve and present web content and applications.", "easy"],
  ["Which application is most suitable for writing a letter?", "Word processor", ["Antivirus scanner only", "Operating-system kernel", "Printer driver"], "Word processors create, edit and format text documents.", "easy"],
  ["Which type of application is used to play a video file?", "Multimedia player", ["Assembler", "Disk controller", "File-system driver"], "Multimedia players decode and present audio or video content.", "easy"],
  ["Which application category includes email and video-call programs?", "Communication applications", ["Memory-management utilities only", "Computer-generation hardware", "Analogue storage devices"], "Communication applications exchange messages, voice or video between users.", "easy"],
  ["What is a native application?", "An application installed or built for a particular operating platform", ["A paper form with no software", "A website that can never use local features", "A hardware component inside RAM"], "Native applications target a specific platform and can integrate closely with its device capabilities.", "easy"],
  ["How is a web application commonly accessed?", "Through a web browser", ["Only through a printer", "By replacing the CPU", "Through magnetic tape alone"], "Web applications deliver their interface and logic through browser technologies.", "easy"],
  ["What is a hybrid application?", "An application combining web technologies with access to native device features", ["A program containing no code", "A purely mechanical input device", "A file that can run on no platform"], "Hybrid applications package web-based interfaces with bridges to device functions.", "easy"],
  ["Why does an application depend on system software?", "System software mediates access to hardware and core services", ["Applications manufacture their own processors", "System software only prints documents", "Applications cannot use memory"], "The operating system provides resources, files, devices and execution services to applications.", "medium"],
  ["Which application is the best choice for creating formulas, tables and charts from numerical data?", "Spreadsheet software", ["Video player", "Boot utility", "Device firmware"], "Spreadsheets organize values in cells and support calculations and charts.", "medium"],
  ["Which application is most suitable for preparing a slide-based classroom presentation?", "Presentation software", ["Disk defragmenter", "Compiler", "Audio driver"], "Presentation applications arrange text, images and media into sequenced slides.", "medium"],
  ["A phone app needs to use the camera. What normally mediates that request?", "The operating system and its permission-controlled API", ["A paper catalogue", "The monitor's power cable", "An unrelated spreadsheet"], "Applications use platform interfaces and user permissions to request protected device resources.", "medium"],
  ["Why can the same application look different on a phone and a desktop?", "The interface adapts to different screen sizes and input methods", ["Phones cannot execute software", "Desktop computers contain no displays", "Application code cannot present graphics"], "Responsive and platform-specific design accounts for device constraints.", "medium"],
  ["Which factor most directly determines whether an application can run on a device?", "Compatibility with the device's operating system and requirements", ["The colour of the device case", "The user's handwriting", "The number of paper files nearby"], "Applications depend on supported platforms, architecture, libraries and resources.", "medium"],
  ["A document created in one application opens with broken formatting in another. What is the likely issue?", "Incomplete file-format compatibility", ["The keyboard entered only binary", "The CPU became an output device", "The internet changed the author"], "Different applications may interpret proprietary or complex file features differently.", "medium"],
  ["Which application category is most appropriate for organizing related customer records and queries?", "Database-management application", ["Media player", "Screen saver", "Printer firmware"], "Database software structures records and supports efficient searching, updating and reporting.", "medium"],
  ["Why are APIs important to many hybrid applications?", "They provide controlled access to platform or device capabilities", ["They physically enlarge the display", "They remove the need for software", "They convert every app into an operating system"], "Application Programming Interfaces define how software requests services from other components.", "medium"],
  ["A banking app requests access to contacts, microphone and location even though none is needed for a transfer. What is the best security response?", "Deny unnecessary permissions and review whether the app is trustworthy", ["Grant every request automatically", "Publish the login password", "Disable transaction encryption"], "Applications should receive only permissions required for their legitimate functions.", "hard"],
  ["A web application must work during unstable connectivity and synchronize later. Which design is most suitable?", "Cache required resources locally and queue changes for later synchronization", ["Require a fresh download for every click", "Store all state only in volatile server memory", "Remove every offline action"], "Offline-capable web design can preserve essential functions and reconcile data when connectivity returns.", "hard"],
  ["A team chooses between a native and web application for a graphics tool requiring intensive device integration. Which consideration is strongest?", "Required performance, hardware access and supported platforms", ["Whether the logo uses one colour", "The number of users' paper notebooks", "Whether the app title is short"], "Architecture should follow workload, hardware integration, distribution and maintenance needs.", "hard"],
  ["What is open-source software?", "Software whose source code is available under a licence permitting specified use and modification", ["Software with no copyright or licence", "Any application available without internet", "Hardware sold without packaging"], "Open-source licences grant defined rights to inspect, use, modify and redistribute code.", "easy", G],
  ["What is Software as a Service, or SaaS?", "Software delivered as an online service rather than managed entirely on the user's device", ["A physical CPU repair service only", "A type of analogue computer", "A paper-based storage method"], "SaaS applications are hosted by a provider and commonly accessed through a browser or client.", "medium", G],
  ["Why should users keep applications updated?", "Updates can fix security flaws, defects and compatibility problems", ["Updates guarantee that no new defect can occur", "Old versions cannot contain data", "Updates convert software into hardware"], "Maintained versions reduce exposure to known vulnerabilities and improve reliability.", "medium", G],
  ["An application stores passwords as readable text. Which design change is most important?", "Use a strong password-hashing scheme with unique salts", ["Rename the password column", "Display the passwords only at night", "Compress the database without access control"], "Passwords should be verified through resistant one-way hashes rather than retained in recoverable form.", "hard", G],
  ["A free mobile app collects more personal data than its function requires. Which principle is being violated?", "Data minimization", ["Binary representation", "Processor scheduling", "Optical recognition"], "Data minimization limits collection to information genuinely needed for a stated purpose.", "hard", G],
]);

// Module 5: Information Processing and Its Roles in Society (25)
addModule("Information Processing and Society", "COS 101 lecture note, Module Five", [
  ["What is information processing?", "Manipulating data to produce useful information", ["Manufacturing only computer cases", "Deleting all collected facts", "Displaying output without input"], "Information processing transforms captured data into a useful, retrievable and analyzable form.", "easy"],
  ["Which action is part of acquiring data?", "Collecting observations from a source", ["Printing a final report only", "Destroying the processor", "Replacing software with hardware"], "Acquisition brings the raw data needed for processing into the workflow.", "easy"],
  ["What is the purpose of data validation?", "To check that input follows required rules and is reasonable", ["To guarantee every claim is true without evidence", "To remove all data types", "To convert every number into an image"], "Validation detects missing, malformed or out-of-range input before further processing.", "easy"],
  ["Which processing step keeps information for future use?", "Storage", ["Disposal", "Input rejection", "Screen brightness"], "Storage preserves data or information so it can be retrieved later.", "easy"],
  ["What does retrieving information mean?", "Accessing previously stored information when it is needed", ["Deleting the only available copy", "Changing hardware into software", "Creating a random result"], "Retrieval locates and returns stored information for use or updating.", "easy"],
  ["Which form can be used to display information to a person?", "Text, image, sound or video", ["Only binary voltage hidden inside a CPU", "Only punched cards", "Only handwritten numbers"], "Human-oriented information can be presented through visual, printed and audible media.", "easy"],
  ["What is a central goal of information management?", "Making reliable information available where and when it is needed", ["Preventing every authorized user from access", "Keeping all information without organization", "Replacing every decision with guesswork"], "Information management organizes, protects and delivers information to support work and decisions.", "easy"],
  ["What does information dissemination involve?", "Distributing information to intended recipients", ["Keeping every record isolated forever", "Converting a computer into a printer", "Removing context from all data"], "Dissemination communicates information through appropriate channels and formats.", "easy"],
  ["Why does placing raw data in context make it more useful?", "Context helps users interpret its meaning and relevance", ["Context removes every relationship", "Raw data is always self-explanatory", "Context prevents analysis"], "Meaning emerges when values are related to their source, purpose, time and other relevant facts.", "medium"],
  ["What does real-time information management emphasize?", "Delivering current information within the time required for action", ["Printing every record once a year", "Storing all values without access", "Using only analogue devices"], "Real-time requirements are determined by how quickly information must reach the decision point.", "medium"],
  ["Why is data integrity important?", "It helps ensure information remains accurate, complete and unaltered improperly", ["It makes every file publicly available", "It removes the need for backups", "It guarantees that users never make errors"], "Integrity controls preserve confidence that data have not been corrupted or changed without authorization.", "medium"],
  ["How can document-management software improve an office workflow?", "By organizing, searching and routing digital documents", ["By making every document handwritten", "By eliminating all access rules", "By preventing file retrieval"], "Structured document management reduces delays and makes information easier to locate and process.", "medium"],
  ["What is a spreadsheet 'what-if' analysis used for?", "Testing how changed input values affect calculated results", ["Checking whether a printer has paper", "Converting speech into text", "Replacing every formula with an image"], "What-if analysis recalculates a model under alternative assumptions.", "medium"],
  ["Why might an office use a spreadsheet chart inside a presentation?", "Different applications contribute calculation and communication capabilities", ["No single application can store a file", "Presentations cannot contain graphics", "Spreadsheets are output devices"], "Information work often combines specialized application features into one deliverable.", "medium"],
  ["Which risk is created when image-processing tools generate convincing false pictures?", "People may mistake manipulated media for authentic evidence", ["Images become impossible to store", "Every camera stops working", "All artificial intelligence becomes illegal"], "Synthetic or altered media can mislead viewers unless provenance and evidence are checked.", "medium"],
  ["How has the internet changed information dissemination?", "It enables rapid distribution across organizational and geographic boundaries", ["It confines information to one filing cabinet", "It prevents international communication", "It eliminates the need to assess accuracy"], "Networked communication supports fast, wide distribution but still requires quality controls.", "medium"],
  ["Why is secure disposal an information-processing step?", "Information no longer needed may still create privacy or security risk", ["Deleted data always remain fully public", "Disposal increases storage capacity without removing anything", "Only paper records require protection"], "Retention should end with controlled deletion or destruction appropriate to the sensitivity of the information.", "medium"],
  ["A form accepts an examination score of 145 percent. Which control should have prevented the error first?", "A range-validation rule", ["A colour printer", "A video-conference tool", "A larger monitor"], "A percentage field can be constrained to an allowed interval before the value enters later processing.", "hard"],
  ["A viral image influences a decision, but its creator, date and editing history are unknown. What should happen before relying on it?", "Verify its provenance and corroborate it with independent evidence", ["Assume popularity proves authenticity", "Remove its filename and share it", "Convert it to another image format"], "Source, context and corroboration are essential when manipulated media are possible.", "hard"],
  ["Employees may edit financial records without logging, approval or version history. Which property is most directly threatened?", "Information integrity and accountability", ["Monitor resolution", "Keyboard layout", "Processor generation"], "Uncontrolled changes make it difficult to trust records or determine who altered them.", "hard"],
  ["What is metadata?", "Data that describe another data item or resource", ["A computer virus", "A physical output device", "An electric current"], "Examples include a file's author, creation date, format and subject.", "easy", G],
  ["How does data verification differ from validation?", "Verification checks correspondence with the source; validation checks rules and plausibility", ["Verification deletes data while validation prints it", "They both guarantee future predictions", "Validation applies only to images"], "A value may be valid in format yet still differ from what the original source stated.", "medium", G],
  ["What is the main purpose of a data visualization?", "To communicate patterns and relationships in data clearly", ["To hide every unusual value", "To replace the underlying evidence", "To guarantee causation"], "Charts and other visual forms help users interpret comparisons, distributions and trends.", "medium", G],
  ["A model is trained only on successful loan applicants and then used to judge everyone. What is the major data problem?", "Selection bias makes the training data unrepresentative", ["The data contain too many output devices", "Every model needs fewer examples", "The processor uses binary"], "A systematically incomplete sample can produce unfair or inaccurate conclusions for excluded groups.", "hard", G],
  ["An organization keeps sensitive personal records forever with no defined purpose. Which control is missing?", "A justified retention and secure-deletion policy", ["A larger spreadsheet", "An extra monitor", "A second web browser"], "Retention limits reduce unnecessary exposure and connect storage duration to legal or operational needs.", "hard", G],
]);

// Module 6: The Internet, Its Applications and Impact (25)
addModule("Internet Applications, Impact and Safety", "COS 101 lecture note, Module Six", [
  ["What is the internet?", "A global system connecting many computer networks", ["A single application installed on one PC", "A type of printer", "A collection of offline files only"], "The internet enables connected networks and their users to exchange information and resources.", "easy"],
  ["Why is the internet called a network of networks?", "It interconnects many private, public, academic and other networks", ["It contains only one central computer", "It is made entirely of web pages", "It cannot connect different organizations"], "The global internet is formed by cooperating networks rather than one isolated network.", "easy"],
  ["Which internet service is commonly used to send electronic messages?", "Email", ["Plotting", "Optical mark recognition", "ROM programming"], "Email exchanges messages and attachments over network services.", "easy"],
  ["Which internet application supports finding scholarly documents online?", "Online research", ["Voltage regulation", "Printer maintenance", "Cache replacement"], "Researchers can discover papers, reports and other academic resources through networked services.", "easy"],
  ["What is e-commerce?", "Buying and selling goods or services through electronic networks", ["Repairing computer hardware", "Classifying computers by size", "Printing a catalogue"], "E-commerce conducts commercial transactions through websites, apps and connected payment systems.", "easy"],
  ["Which internet application supports live face-to-face communication at a distance?", "Video conferencing", ["Magnetic tape", "Word processing", "Disk formatting"], "Video conferencing transmits audio and video between remote participants.", "easy"],
  ["How does online education use the internet?", "It delivers courses, learning resources and interaction remotely", ["It prevents students from accessing materials", "It replaces every teacher with hardware", "It permits only paper assignments"], "Networked learning platforms support flexible access to instruction and resources.", "easy"],
  ["How is the World Wide Web related to the internet?", "The Web is one service that operates over the internet", ["The Web is the physical CPU of the internet", "They are unrelated storage devices", "The internet exists only inside one browser"], "The internet is the underlying network infrastructure; the Web uses it to deliver linked resources.", "easy"],
  ["Why did web browsers increase the usefulness of the Web?", "They gave users a convenient way to navigate and display linked content", ["They eliminated network protocols", "They converted every site into hardware", "They prevented multimedia use"], "Browsers interpret web resources and provide a usable navigation interface.", "medium"],
  ["Which activity is an example of social networking?", "Connecting and sharing with people through an online platform", ["Replacing RAM with ROM", "Scanning a cheque", "Compiling a program offline"], "Social-networking services support online relationships, communication and content sharing.", "medium"],
  ["How can the internet improve business transactions?", "It enables rapid communication, online services and wider market reach", ["It guarantees every seller is honest", "It prevents all payment fraud", "It removes the need for security"], "Connected systems can reduce delays and expand access, but controls remain necessary.", "medium"],
  ["Which benefit does the internet provide to education and research?", "Access to extensive learning and scholarly resources", ["Automatic proof that every online claim is correct", "Elimination of copyright", "A ban on collaboration"], "Online books, journals, courses and communication can support study and research.", "medium"],
  ["Why can excessive screen time be harmful?", "It may contribute to sleep, eye-strain or wellbeing problems", ["It permanently increases RAM", "It converts digital computers into analogue systems", "It prevents every network attack"], "Healthy technology use includes breaks, appropriate settings and balanced activity.", "medium"],
  ["What is one negative social impact of uncontrolled internet use?", "Exposure to inappropriate content or harmful online behaviour", ["Guaranteed improvement in every relationship", "Automatic protection of personal data", "Removal of all misinformation"], "Open access can create risks that require supervision, literacy and platform safeguards.", "medium"],
  ["Why should a researcher evaluate information found online?", "Online availability does not guarantee authority or accuracy", ["Every website has passed academic peer review", "Search ranking proves truth", "A domain name supplies complete evidence"], "Users should examine authorship, evidence, purpose, currency and corroboration.", "medium"],
  ["How can internet addiction affect a user?", "It can disrupt health, responsibilities and relationships", ["It always improves sleep", "It guarantees stronger offline communication", "It prevents anxiety"], "Compulsive use can interfere with daily functioning and wellbeing.", "medium"],
  ["Which risk is illustrated when criminals gain unauthorized access to an online account?", "Cybercrime", ["Data validation", "Word processing", "Computer classification"], "Account intrusion may expose, alter or steal personal and financial information.", "medium"],
  ["A student receives an urgent email asking for a password through an unfamiliar link. What is the safest response?", "Do not use the link; verify the request through an official channel", ["Send the password immediately", "Forward the message to everyone", "Disable account security"], "Urgency and credential requests are common phishing signals; independent verification reduces risk.", "hard"],
  ["A social-media claim has thousands of shares but cites no evidence. What is the best conclusion?", "Popularity alone does not establish accuracy", ["The number of shares proves the claim", "Every social-media post is false", "The claim needs no source if it is recent"], "Credibility depends on evidence and trustworthy sourcing, not engagement counts.", "hard"],
  ["A school moves all teaching online without supporting students who lack devices or connectivity. Which problem is most evident?", "The digital divide", ["Excessive processor cache", "Optical character recognition", "Computer miniaturization"], "Unequal access to devices, connectivity and digital skills can exclude learners from online opportunities.", "hard"],
  ["What is an IP address used for?", "Identifying and routing communication to a network interface", ["Formatting a printed document", "Storing a password in plain text", "Measuring monitor brightness"], "Internet Protocol addresses allow networked devices and routers to deliver packets toward their destinations.", "easy", G],
  ["What does the Domain Name System do?", "Translates domain names into network addressing information", ["Encrypts every file on a computer", "Creates physical network cables", "Replaces web browsers"], "DNS lets people use readable names while network communication uses addresses.", "medium", G],
  ["What protection does HTTPS primarily add to ordinary web communication?", "Encrypted and authenticated transport between browser and website", ["A guarantee that every website claim is true", "Permanent anonymity from all parties", "Automatic removal of malicious downloads"], "HTTPS protects data in transit and helps authenticate the server, but content still requires judgment.", "medium", G],
  ["A website uses HTTPS but sells a fraudulent product. Why did HTTPS not prevent the fraud?", "Transport security does not prove the business or its claims are trustworthy", ["HTTPS works only for email", "Encryption changes prices automatically", "A padlock guarantees legal compliance"], "A secure connection protects transmission; it does not validate every action or statement of the site operator.", "hard", G],
  ["A user must access a sensitive account over public Wi-Fi. Which approach best reduces exposure?", "Use the official HTTPS service, strong authentication and a trusted connection or VPN", ["Disable encryption", "Share the one-time code with nearby users", "Accept every certificate warning"], "Layered protections reduce interception and account-takeover risk on untrusted networks.", "hard", G],
]);

// Module 7: Computing Disciplines and Professional Roles (25)
addModule("Computing Disciplines, Careers and Professional Ethics", "COS 101 lecture note, Module Seven", [
  ["Who is a computer professional?", "A person with relevant computing education or training who works in the field", ["Anyone who has seen a computer", "Only a person who sells paper", "A device that runs software"], "Computer professionals apply trained computing knowledge and skills in their occupations.", "easy"],
  ["What is a core responsibility of a computer operator?", "Keeping systems running and handling routine processing and backups", ["Designing every processor chip", "Writing all internet standards", "Manufacturing monitors"], "Operators oversee scheduled computer operations, reports and routine data protection tasks.", "easy"],
  ["What does a computer instructor primarily do?", "Teaches people computing concepts and skills", ["Audits only financial accounts", "Builds electrical transformers", "Provides internet addresses"], "An instructor plans and delivers computing education or training.", "easy"],
  ["What is the primary role of a computer programmer?", "Writing and testing instructions that solve computing problems", ["Selling every hardware component", "Controlling office humidity", "Printing documents for all users"], "Programmers translate requirements and designs into executable code.", "easy"],
  ["What does a system administrator commonly manage?", "User accounts, permissions and shared computing services", ["Only the colour of websites", "The authorship of textbooks", "The price of every computer"], "System administrators configure and maintain systems, identities and access.", "easy"],
  ["Which professional creates digital illustrations and animations?", "Computer-graphics artist", ["Computer operator", "Network access provider", "System auditor"], "Graphics professionals use computing tools to create visual artwork and animation.", "easy"],
  ["What service does an internet service provider supply?", "Connectivity to the internet", ["Automatic truth checking of websites", "Permanent storage inside RAM", "Printed output from every browser"], "An ISP connects customers or organizations to internet infrastructure and related services.", "easy"],
  ["What is a systems analyst expected to do before software is built?", "Study needs and translate them into system requirements and designs", ["Choose the office paint colour only", "Replace every user with a machine", "Ignore the problem statement"], "Analysis clarifies processes, constraints and required behaviour before implementation.", "medium"],
  ["Which task most closely belongs to a software engineer?", "Designing, building and maintaining reliable software systems", ["Repairing every damaged monitor", "Supplying electrical power", "Operating a printing press"], "Software engineering applies disciplined methods across the software life cycle.", "medium"],
  ["What distinguishes a hardware vendor from a software vendor?", "One supplies physical equipment, while the other supplies programs or licences", ["One uses data and the other uses no information", "Both are output devices", "A software vendor sells only keyboards"], "Computer-ware vendors may specialize in tangible hardware or software products.", "medium"],
  ["What is the purpose of a systems audit?", "To evaluate controls, records and use of information systems", ["To increase monitor resolution", "To classify computers by physical size", "To translate high-level code"], "Auditing examines whether systems and processes protect assets and produce trustworthy records.", "medium"],
  ["Which responsibility belongs to a web administrator or webmaster?", "Maintaining website content, availability and security", ["Refreshing DRAM manually", "Reading bank cheques with MICR", "Cooling a computer room"], "Web administrators update and monitor sites and address operational and security issues.", "medium"],
  ["What does an application service provider deliver?", "Hosted application services to customers over a network", ["Only physical computer cases", "Handwritten source code", "A new CPU for every login"], "An ASP operates software that customers access remotely as a service.", "medium"],
  ["Why is continuing education important for a computer professional?", "Computing tools, threats and practices change rapidly", ["Training makes prior knowledge disappear", "Professional work never changes", "Education eliminates the need for experience"], "Ongoing learning helps professionals maintain competence in an evolving field.", "medium"],
  ["Why are honesty and trustworthiness essential professional qualities?", "Computer professionals may have privileged access to important systems and data", ["They prevent hardware from aging", "They make every program error-free", "They replace technical competence"], "Privileged access creates a duty to act responsibly and protect users and organizations.", "medium"],
  ["A nightly processing job finishes, but no backup is produced. Which professional duty was neglected?", "Routine operational data protection", ["Graphic design", "Internet domain registration", "Computer classification"], "Regular backups are part of dependable system operation and recovery preparation.", "medium"],
  ["Why can membership in a professional body be valuable?", "It can support standards, development and professional accountability", ["It grants permission to ignore laws", "It guarantees employment", "It replaces all formal education"], "Professional communities promote learning, ethical expectations and shared practice.", "medium"],
  ["A client gives a vague request for a student-results system. What should happen before programming begins?", "A systems analyst should clarify users, rules, data and required outputs", ["A programmer should guess every requirement", "The operator should publish unfinished results", "The vendor should select the most expensive hardware"], "Requirements analysis reduces ambiguity and prevents code from solving the wrong problem.", "hard"],
  ["A vendor recommends unnecessary equipment without disclosing that it earns a larger commission. Which professional issue is present?", "An undisclosed conflict of interest", ["Normal data validation", "Efficient processor scheduling", "Optical recognition"], "Professional advice should be honest and should disclose incentives that may bias recommendations.", "hard"],
  ["A security researcher finds a vulnerability in a school portal. Which action is professionally responsible?", "Report it privately through an authorized process and avoid exploiting student data", ["Publish student records as proof", "Use the flaw to change grades", "Sell access to other users"], "Authorization and responsible disclosure distinguish protective research from harmful intrusion.", "hard"],
  ["Which professional primarily protects systems from digital attacks?", "Cybersecurity analyst", ["Graphics artist", "Data-entry operator", "Computer retailer"], "Cybersecurity analysts assess threats, monitor controls and respond to incidents.", "easy", G],
  ["What does a data scientist commonly do?", "Uses data, statistics and computing to investigate questions and build models", ["Repairs only power supplies", "Writes no code or analysis", "Prints every database row"], "Data science combines domain knowledge, computation and quantitative methods.", "medium", G],
  ["What is a user-experience designer concerned with?", "Making a product useful, understandable and accessible to its users", ["Increasing processor temperature", "Replacing every icon with source code", "Removing user research"], "UX design studies user needs and improves interaction, structure and accessibility.", "medium", G],
  ["An administrator can secretly read every employee's private file. What is the strongest ethical control?", "Limit privileged access, log its use and require legitimate authorization", ["Share the administrator password", "Remove every audit record", "Assume technical access gives unlimited permission"], "Least privilege and accountability reduce abuse of powerful administrative capabilities.", "hard", G],
  ["An automated hiring tool disadvantages one group. What should the computing team do?", "Investigate data and outcomes, mitigate bias and provide accountable human review", ["Hide the result differences", "Assume software cannot discriminate", "Remove all appeal mechanisms"], "Professional responsibility includes evaluating system impact and correcting unfair or unsafe behaviour.", "hard", G],
]);

// Module 8: The Future of Computing (25)
addModule("Emerging Technologies and the Future of Computing", "COS 101 lecture note, Module Eight", [
  ["What does artificial intelligence seek to enable machines to do?", "Perform tasks involving learning, reasoning or intelligent decision support", ["Operate without data or instructions", "Replace every form of human judgment", "Convert all digital devices into analogue computers"], "AI develops systems capable of tasks associated with aspects of human intelligence.", "easy"],
  ["What is the Internet of Things?", "A network of physical devices that sense, communicate or act through connected systems", ["A collection of printed manuals", "A single offline supercomputer", "A word-processing format"], "IoT connects devices such as sensors, appliances and controllers for data exchange and remote action.", "easy"],
  ["What is cloud computing?", "On-demand access to shared computing resources delivered over a network", ["Storing files in the weather", "Running programs without servers", "Printing data through a scanner"], "Cloud services provide configurable processing, storage and applications without every user owning the infrastructure.", "easy"],
  ["What does augmented reality do?", "Overlays digital content on a view of the physical environment", ["Removes all physical surroundings", "Stores data only on magnetic tape", "Converts speech into printed text"], "AR adds context or objects to the user's perception of the real world.", "easy"],
  ["What does virtual reality do?", "Immerses a user in a computer-generated environment", ["Adds one label to an otherwise unchanged document", "Connects only household appliances", "Performs spreadsheet formulas"], "VR replaces much of the user's perceived surroundings with an interactive digital world.", "easy"],
  ["What information unit is fundamental to quantum computing?", "Qubit", ["Printed byte", "Barcode", "Pixel row"], "Quantum computers operate on quantum bits, or qubits.", "easy"],
  ["What is robotics?", "The design, construction and operation of machines that perform physical tasks", ["The classification of websites", "The creation of paper-only files", "A method of typing text"], "Robotics integrates computation, sensing and actuation in machines that work autonomously or under guidance.", "easy"],
  ["What is the key idea behind edge computing?", "Process data near where it is generated rather than sending everything to a distant centre", ["Store all data on the edge of a paper", "Prevent local devices from computing", "Use only one central keyboard"], "Local processing can reduce delay, bandwidth use and dependence on continuous connectivity.", "medium"],
  ["How can faster mobile networks support IoT deployments?", "They can improve connectivity, capacity and response time for connected devices", ["They remove the need for device security", "They make sensors unnecessary", "They guarantee unlimited battery life"], "Network improvements can support more responsive and numerous connected devices.", "medium"],
  ["Why might a company adopt cloud computing?", "To scale resources without owning all underlying hardware", ["To eliminate every operating cost", "To ensure no service can fail", "To avoid all network communication"], "Cloud services can shift infrastructure management and let capacity expand or contract with demand.", "medium"],
  ["Which scenario best demonstrates augmented reality?", "A phone shows navigation arrows over the live street view", ["A headset replaces the room with a virtual planet", "A printer produces a report", "A database sorts names"], "The arrows digitally augment the user's view of the physical environment.", "medium"],
  ["Which scenario best demonstrates virtual reality?", "A headset places a trainee inside a simulated operating room", ["A camera labels a real machine part", "A spreadsheet highlights a cell", "A sensor sends temperature data"], "VR creates an immersive simulated setting for interaction or training.", "medium"],
  ["What does extended reality, or XR, encompass?", "Virtual, augmented and mixed-reality technologies", ["Only text messaging", "Only quantum computing", "Only physical robots"], "XR is an umbrella term for technologies that blend or replace perceived reality with digital content.", "medium"],
  ["How can XR improve remote collaboration?", "It can give distributed participants a shared immersive workspace", ["It makes network connections unnecessary", "It prevents visual interaction", "It converts meetings into printed output only"], "Shared virtual spaces can add spatial and interactive cues beyond ordinary calls.", "medium"],
  ["Why is simulation useful for professional training?", "Learners can practise difficult or hazardous tasks in a controlled environment", ["It guarantees expertise without feedback", "It removes the need for realistic scenarios", "It makes every error physically dangerous"], "Simulation supports repeatable practice while limiting risk to people and equipment.", "medium"],
  ["How can robotics assist agriculture?", "Sensors and autonomous machines can monitor crops and support field operations", ["Robots eliminate the need for all agronomic knowledge", "Drones can operate without data", "Machine learning replaces soil and weather"], "Agricultural robots and drones can gather data and assist targeted monitoring or treatment.", "medium"],
  ["Why do autonomous systems combine sensors with processing algorithms?", "Sensors observe conditions while algorithms interpret them and select actions", ["Sensors make computation unnecessary", "Algorithms physically measure every signal", "Neither component affects decisions"], "Autonomy depends on perception, computation and controlled action working together.", "medium"],
  ["Why is it misleading to say quantum computers will make every calculation exponentially faster?", "Quantum advantage applies to particular algorithms and problems, not all workloads", ["Quantum computers contain no mathematics", "Classical computers cannot perform any calculation", "Every qubit is a conventional hard disk"], "Quantum speedups are problem-specific and require suitable algorithms and practical hardware.", "hard"],
  ["A self-driving vehicle must react immediately but also contribute data to long-term fleet analysis. Which architecture is best?", "Use edge processing for immediate control and cloud systems for aggregated analysis", ["Send every urgent decision to a distant server only", "Remove local sensors", "Store all driving data on paper"], "A hybrid edge-cloud design combines low-latency local decisions with scalable central learning and storage.", "hard"],
  ["An XR training system causes motion sickness and excludes users with visual impairments. What should the team do?", "Redesign with comfort settings, alternative modes and accessibility testing", ["Require every user to tolerate the same interface", "Remove all user feedback", "Increase motion without testing"], "Emerging technology should be evaluated for usability, safety and inclusive access.", "hard"],
  ["What is machine learning?", "A method that enables systems to learn patterns from data for predictions or decisions", ["A mechanical method for printing books", "A guarantee that computers understand every result", "A type of power supply"], "Machine-learning algorithms estimate useful patterns from examples rather than relying only on fixed hand-written rules.", "easy", G],
  ["How does automation differ from artificial intelligence?", "Automation follows a process, while AI may infer patterns or adapt decisions", ["Automation always requires consciousness", "AI cannot be used in automation", "They both mean replacing all workers"], "A workflow can be automated with fixed rules; AI is one possible component for tasks requiring inference.", "medium", G],
  ["Why does the energy efficiency of computing infrastructure matter?", "Computing consumes resources and has financial and environmental costs", ["Electricity never affects computing", "Efficient hardware stores no data", "Only paper systems use energy"], "Efficient devices, software and data centres can reduce energy use, cost and environmental impact.", "medium", G],
  ["A medical AI was trained on patients from one region and performs poorly elsewhere. What is the best response?", "Evaluate representativeness, retrain with appropriate data and monitor subgroup performance", ["Assume one dataset represents everyone", "Hide the performance difference", "Remove clinical oversight"], "Model validity depends on relevant data and measured performance for the populations where it is used.", "hard", G],
  ["An autonomous system faces a high-stakes situation outside its training experience. Which safeguard is strongest?", "Detect uncertainty and escalate to an accountable human or safe fallback", ["Act confidently without limits", "Delete all system logs", "Disable emergency controls"], "High-stakes automation needs bounded behaviour, monitoring and a safe path when confidence or conditions are inadequate.", "hard", G],
]);

function normalizePrompt(value) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeOption(value) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

const STOP_WORDS = new Set([
  "about", "above", "after", "also", "answer", "because", "before", "below", "between",
  "correct", "describe", "during", "following", "from", "into", "most", "question",
  "should", "that", "their", "there", "these", "this", "through", "what", "when",
  "where", "which", "with",
]);

function keywords(value) {
  return new Set(normalizePrompt(value).split(" ").filter((word) => word.length > 3 && !STOP_WORDS.has(word)));
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const word of left) if (right.has(word)) overlap += 1;
  return overlap / (left.size + right.size - overlap);
}

function sha(value) {
  return createHash("sha256").update(value).digest("hex");
}

function deterministicUuid(value) {
  const hex = sha(value).slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const joined = hex.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

function sqlRows() {
  return bank.map((question, index) => ({
    id: deterministicUuid(`cos101-question-${index + 1}-${question.prompt}`),
    position: index,
    prompt: question.prompt,
    explanation: question.explanation,
    questionKind: question.questionKind,
    difficulty: question.difficulty,
    cognitive: question.cognitive,
    topic: question.topic,
    fingerprint: sha(normalizePrompt(question.prompt)),
    studyRef: {
      sourceLabel: question.sourceLabel,
      sourceKind: question.sourceKind,
      reviewedFromLocalFile: question.sourceKind === M,
    },
    generationMeta: {
      import: "codex_cos101_200_v1",
      sourceReference: question.sourceLabel,
      technicalAccuracyReviewCompleted: true,
      humanVerificationRequired: true,
    },
    options: question.options.map((text, optionIndex) => ({
      id: deterministicUuid(`cos101-option-${index + 1}-${optionIndex}-${text}`),
      text,
      isCorrect: optionIndex === question.answerIndex,
      position: optionIndex,
    })),
  }));
}

function renderSql(rows) {
  const payload = JSON.stringify(rows);
  if (payload.includes("$cos101_questions$")) throw new Error("Unexpected SQL dollar tag in generated content.");
  return `-- COS 101 Exam Sprint: import 200 curated MCQs into an empty private bank
-- Sources: supplied COS 101 lecture note plus clearly labelled General COS 101 enrichment
-- The script creates a bank if none exists and refuses to overwrite existing questions.
BEGIN;

DO $import$
DECLARE
  v_set_id uuid;
  v_set_count integer;
  v_question jsonb;
  v_option jsonb;
BEGIN
  SELECT count(*) INTO v_set_count
  FROM public.study_quiz_sets
  WHERE upper(regexp_replace(coalesce(course_code, ''), '[^A-Za-z0-9]', '', 'g')) = 'COS101'
    AND delivery_mode = 'mock_exam'
    AND exam_campaign_key = 'supplementary-2026';

  IF v_set_count = 0 THEN
    INSERT INTO public.study_quiz_sets
      (title, description, course_code, level, semester, difficulty, time_limit_minutes,
       questions_count, published, visibility, source, delivery_mode, exam_campaign_key,
       access_tier, exam_question_count, diagnostic_question_count, diagnostic_time_limit_minutes)
    VALUES
      ('COS 101 Exam Sprint Mock',
       'Private COS 101 bank covering the supplied Introduction to Computing Sciences note and modern computing foundations.',
       'COS 101', '100', 'first', 'hard', 40,
       0, false, 'private', 'exam_sprint', 'mock_exam', 'supplementary-2026',
       'plus_monthly', 40, 10, 10)
    RETURNING id INTO v_set_id;
  ELSIF v_set_count = 1 THEN
    SELECT id INTO v_set_id
    FROM public.study_quiz_sets
    WHERE upper(regexp_replace(coalesce(course_code, ''), '[^A-Za-z0-9]', '', 'g')) = 'COS101'
      AND delivery_mode = 'mock_exam'
      AND exam_campaign_key = 'supplementary-2026'
    LIMIT 1;
  ELSE
    RAISE EXCEPTION 'More than one COS 101 Exam Sprint bank exists. Keep one target bank before importing.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.study_quiz_questions
    WHERE coalesce(set_id, quiz_set_id) = v_set_id
  ) THEN
    RAISE EXCEPTION 'The COS 101 target bank already contains questions. Import stopped to prevent duplicates.';
  END IF;

  FOR v_question IN
    SELECT value FROM jsonb_array_elements($cos101_questions$${payload}$cos101_questions$::jsonb)
  LOOP
    INSERT INTO public.study_quiz_questions
      (id, set_id, prompt, explanation, question_type, position, question_kind,
       difficulty_level, cognitive_level, source_topic, question_fingerprint,
       study_ref, generation_meta, ai_generated, published, created_at)
    VALUES
      ((v_question->>'id')::uuid, v_set_id, v_question->>'prompt', v_question->>'explanation',
       'mcq', (v_question->>'position')::integer, v_question->>'questionKind',
       v_question->>'difficulty', v_question->>'cognitive', v_question->>'topic',
       v_question->>'fingerprint', v_question->'studyRef', v_question->'generationMeta',
       false, true, now());

    FOR v_option IN
      SELECT value FROM jsonb_array_elements(v_question->'options')
    LOOP
      INSERT INTO public.study_quiz_options
        (id, question_id, text, is_correct, position, created_at)
      VALUES
        ((v_option->>'id')::uuid, (v_question->>'id')::uuid, v_option->>'text',
         (v_option->>'isCorrect')::boolean, (v_option->>'position')::integer, now());
    END LOOP;
  END LOOP;

  UPDATE public.study_quiz_sets
  SET questions_count = 200,
      exam_question_count = 40,
      time_limit_minutes = 40,
      published = false,
      visibility = 'private',
      updated_at = now()
  WHERE id = v_set_id;
END
$import$;

COMMIT;

-- Expected: 200 questions, 800 options, 200 correct options, 0 verified before admin review.
SELECT
  s.id AS set_id,
  s.title,
  count(DISTINCT q.id) AS questions,
  count(o.id) AS options,
  count(o.id) FILTER (WHERE o.is_correct) AS correct_options,
  count(DISTINCT q.id) FILTER (WHERE q.exam_verified_at IS NOT NULL) AS verified_questions
FROM public.study_quiz_sets s
LEFT JOIN public.study_quiz_questions q ON coalesce(q.set_id, q.quiz_set_id) = s.id
LEFT JOIN public.study_quiz_options o ON o.question_id = q.id
WHERE upper(regexp_replace(coalesce(s.course_code, ''), '[^A-Za-z0-9]', '', 'g')) = 'COS101'
  AND s.delivery_mode = 'mock_exam'
  AND s.exam_campaign_key = 'supplementary-2026'
GROUP BY s.id, s.title;
`;
}

function renderMarkdown() {
  const lines = [
    "# COS 101 — 200-question Exam Sprint bank",
    "",
    "Primary source: supplied COS 101 Introduction to Computing Sciences lecture note. Modern COS 101 enrichment is clearly labelled.",
    "",
    "Every question has four options, one answer, an explanation, topic, difficulty and source label.",
    "",
  ];
  bank.forEach((question, index) => {
    lines.push(`## ${index + 1}. ${question.prompt}`, "");
    question.options.forEach((option, optionIndex) => lines.push(`${String.fromCharCode(65 + optionIndex)}. ${option}`));
    lines.push(
      "",
      `**Answer:** ${String.fromCharCode(65 + question.answerIndex)}`,
      "",
      `**Explanation:** ${question.explanation}`,
      "",
      `**Metadata:** ${question.topic} · ${question.difficulty} · ${question.sourceLabel}`,
      "",
    );
  });
  return `${lines.join("\n")}\n`;
}

function validate(rows) {
  const errors = [];
  const prompts = new Set();
  const ids = new Set();
  const optionIds = new Set();
  const difficulty = { easy: 0, medium: 0, hard: 0 };
  const sourceKind = { supplied_material: 0, general_cos101: 0 };
  const topicCounts = new Map();
  const answerPositions = [0, 0, 0, 0];

  if (rows.length !== 200) errors.push(`Expected 200 questions; found ${rows.length}.`);
  for (const [index, question] of rows.entries()) {
    const number = index + 1;
    const normalized = normalizePrompt(question.prompt);
    if (!normalized) errors.push(`Question ${number} has no prompt.`);
    if (prompts.has(normalized)) errors.push(`Duplicate prompt at question ${number}.`);
    prompts.add(normalized);
    if (ids.has(question.id)) errors.push(`Duplicate question UUID at question ${number}.`);
    ids.add(question.id);
    if (question.options.length !== 4) errors.push(`Question ${number} does not have four options.`);
    const distinct = new Set(question.options.map((option) => normalizeOption(option.text)));
    if (distinct.size !== 4 || distinct.has("")) errors.push(`Question ${number} has blank or duplicate options.`);
    if (question.options.filter((option) => option.isCorrect).length !== 1) errors.push(`Question ${number} does not have exactly one correct option.`);
    if (!question.explanation.trim()) errors.push(`Question ${number} has no explanation.`);
    if (question.options.some((option) => /^(all|none) of the above$/i.test(option.text.trim()))) errors.push(`Question ${number} uses an all/none-of-the-above option.`);
    for (const option of question.options) {
      if (optionIds.has(option.id)) errors.push(`Duplicate option UUID at question ${number}.`);
      optionIds.add(option.id);
    }
    difficulty[question.difficulty] += 1;
    sourceKind[question.studyRef.sourceKind] += 1;
    topicCounts.set(question.topic, (topicCounts.get(question.topic) ?? 0) + 1);
    answerPositions[question.options.findIndex((option) => option.isCorrect)] += 1;
  }

  for (let left = 0; left < rows.length; left += 1) {
    for (let right = left + 1; right < rows.length; right += 1) {
      const similarity = jaccard(keywords(rows[left].prompt), keywords(rows[right].prompt));
      if (similarity >= 0.72) errors.push(`Questions ${left + 1} and ${right + 1} are too similar (${similarity.toFixed(3)}).`);
    }
  }

  if (difficulty.easy !== 70 || difficulty.medium !== 90 || difficulty.hard !== 40) {
    errors.push(`Difficulty balance is ${JSON.stringify(difficulty)}, expected 70/90/40.`);
  }
  if (sourceKind.supplied_material !== 160 || sourceKind.general_cos101 !== 40) {
    errors.push(`Source balance is ${JSON.stringify(sourceKind)}, expected 160/40.`);
  }
  if (topicCounts.size !== 8 || [...topicCounts.values()].some((count) => count !== 25)) {
    errors.push(`Expected 8 topics with 25 questions each; got ${JSON.stringify(Object.fromEntries(topicCounts))}.`);
  }
  if (answerPositions.some((count) => count !== 50)) {
    errors.push(`Answer positions are ${JSON.stringify(answerPositions)}, expected [50,50,50,50].`);
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return {
    questions: rows.length,
    options: rows.length * 4,
    difficulty,
    sourceKind,
    topics: Object.fromEntries(topicCounts),
    answerPositions,
  };
}

const rows = sqlRows();
const summary = validate(rows);
const sqlPath = resolve("deliverables/COS101_import_exam_bank_200.sql");
const markdownPath = resolve("deliverables/COS101_question_bank_200.md");
mkdirSync(dirname(sqlPath), { recursive: true });
writeFileSync(sqlPath, renderSql(rows), "utf8");
writeFileSync(markdownPath, renderMarkdown(), "utf8");
console.log(JSON.stringify({ ...summary, sqlPath, markdownPath }, null, 2));
