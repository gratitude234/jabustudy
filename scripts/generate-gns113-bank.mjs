import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const bank = [];
const M = "supplied_material";
const G = "general_gns113";

function addTopic(topic, materialLabel, rows) {
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
      sourceLabel: sourceKind === M ? materialLabel : `General GNS 113 enrichment: ${topic}`,
      cognitive: difficulty === "easy" ? "recall" : difficulty === "hard" ? "analysis" : "application",
      questionKind: difficulty === "easy" ? "concept" : "application",
    });
  }
}

// 1. Library foundations, history and materials (20)
addTopic("Library Foundations, History and Materials", "GNS 113 module, Study Session 1", [
  ["From which Latin word is the term library derived?", "Liber", ["Libertas", "Librarius", "Logos"], "The module traces library to the Latin word liber, meaning book.", "easy"],
  ["Which statement best distinguishes a library from a mere collection of books?", "Its materials are organized, preserved and made available for use", ["It sells every book it holds", "It contains printed books only", "It excludes trained personnel and users"], "A library systematically identifies, acquires, organizes, preserves and provides access to information materials.", "easy"],
  ["Which item is identified as a basic component of a library?", "Users", ["A publishing factory", "A sports field", "A bookshop cashier"], "The module lists the building, materials, personnel and users as library components.", "easy"],
  ["Which library material is classified as print?", "A hardcopy journal", ["An audiobook", "A microfilm", "An e-book"], "Books, journals and printed reference works are print materials.", "easy"],
  ["Which item is a digital library material?", "An e-journal", ["A clay tablet", "A printed yearbook", "A card catalogue drawer"], "Digital materials include e-books, e-journals, audiobooks and CDs.", "easy"],
  ["Which item is described in the module as an analogue non-print material?", "Microfilm", ["Printed encyclopedia", "E-journal", "Hardcopy textbook"], "Films, slides, tapes, transparencies and microfilms are examples of analogue non-print carriers.", "easy"],
  ["A room has many books but no organized access, trained staff or defined users. Why is it not yet a proper library?", "It lacks essential library organization and service attributes", ["Every library must sell books", "A library cannot contain many books", "Only digital collections qualify as libraries"], "A library is more than accumulated books; it requires systematic organization, personnel and users.", "medium"],
  ["Which attribute helps ensure that library resources remain available for future generations?", "Systematic storage and preservation", ["Frequent disposal of all old materials", "Removing catalogue records", "Restricting the library to staff only"], "Preservation for posterity is one of the attributes identified in the module.", "medium"],
  ["Why is a library collection described as dynamic?", "It grows and changes with users' information needs", ["Its books physically move by themselves", "It must contain one subject only", "It is never evaluated or updated"], "A dynamic collection develops over time rather than remaining fixed.", "medium"],
  ["Which early writing material was associated with the library at Nippur?", "Clay tablets", ["Compact discs", "Printed newspapers", "Microfiche"], "The module describes rooms containing clay tablets at ancient Nippur.", "medium"],
  ["What was notable about Ashurbanipal's collection?", "It contained a large, systematically collected archive of tablets", ["It consisted only of modern journals", "It was the first electronic library", "It prohibited all classification"], "Ashurbanipal maintained a major archive of transcripts and texts gathered from temples.", "medium"],
  ["Which materials were commonly used for Greek school texts in the classical world?", "Papyrus and parchment", ["Optical discs and tapes", "Plastic cards and film", "Only stone monuments"], "The module notes that Greek school texts were written on perishable papyrus and parchment.", "medium"],
  ["What encouraged library and record development in China after 206 BC?", "Renewed literature, record keeping and classification", ["A ban on all written work", "Replacement of records with oral memory", "Elimination of civil-service examinations"], "The period encouraged literary work and record keeping and developed classification systems.", "medium"],
  ["Which combination contains all four components identified for a library?", "Building, materials, personnel and users", ["Building, publisher, market and profit", "Books, cashier, customers and sales", "Computers, electricity, printers and internet only"], "A library needs accommodation, stock, trained personnel and a user community.", "medium"],
  ["A collection has excellent resources and trained staff but no mechanism for users to retrieve materials. Which library function is most directly missing?", "Organized access", ["Commercial book pricing", "Literary authorship", "Printing and binding every item"], "Library value depends on organizing and interpreting resources so they can be found and used.", "hard"],
  ["Why were archives and libraries difficult to distinguish in the earliest periods?", "Both centred on preserving recorded information", ["Neither contained records", "All ancient books were sold immediately", "Libraries existed only after computers"], "Early record rooms and libraries shared the central task of keeping records.", "hard"],
  ["What is a born-digital resource?", "A resource originally created in digital form", ["A printed book later placed on a shelf", "A handwritten clay tablet", "Any book published before computers"], "Born-digital materials originate electronically rather than being converted from print.", "easy", G],
  ["Which activity is digitization?", "Scanning a printed manuscript into an electronic file", ["Alphabetizing physical cards", "Buying another printed copy", "Reading a book aloud without recording it"], "Digitization converts analogue or physical content into digital form.", "medium", G],
  ["A library must choose between preserving a fragile original and allowing unrestricted handling. What is the best balanced response?", "Create an access copy while preserving the original under controlled conditions", ["Destroy the original after one use", "Ban all access permanently", "Allow unlimited handling without safeguards"], "A surrogate supports access while environmental and handling controls protect the original.", "hard", G],
  ["Which preservation action best protects digital files against a single-device failure?", "Maintain verified backups in separate locations", ["Keep the only copy on one flash drive", "Rename the file repeatedly", "Remove all metadata"], "Redundant, verified and geographically separate backups reduce the risk of total data loss.", "hard", G],
]);

// 2. Types and roles of libraries (20)
addTopic("Types and Roles of Libraries", "GNS 113 module, Study Session 2", [
  ["Which library is designated and funded by a national government to serve the nation?", "National library", ["School library", "Special library", "Personal library"], "A national library serves the nation and functions as a national depository.", "easy"],
  ["Which library primarily supports teaching, learning and research in a university?", "Academic library", ["Public library", "National archive only", "Commercial bookshop"], "Academic libraries serve the students, faculty and staff of their parent institutions.", "easy"],
  ["Which library is generally supported by public funds and open to community residents?", "Public library", ["Private corporate library", "School laboratory", "National museum"], "A public library offers community access to resources and services, normally free at the point of use.", "easy"],
  ["Which library usually limits its collection to the interests of a host organization?", "Special library", ["Public library", "National library", "School library"], "A special library serves the focused information needs of an agency, research body or corporation.", "easy"],
  ["Which library serves the curriculum needs of pupils and teachers in primary or secondary education?", "School library", ["National library", "Special library", "Public records office"], "School libraries provide age-appropriate educational materials and encourage independent reading.", "easy"],
  ["Which institution compiles a national bibliography according to the module?", "National library", ["Every bookshop", "A school library only", "A corporate archive"], "Compilation of the national bibliography is a national-library responsibility.", "easy"],
  ["A petroleum company maintains a focused collection for its engineers and geologists. What type of library is it?", "Special library", ["National library", "Public library", "School library"], "The collection supports employees of a particular organization and subject area.", "medium"],
  ["A resident wants free access to general reading materials without being enrolled in a school. Which library best fits?", "Public library", ["Academic library restricted to a campus", "Private laboratory collection", "School library"], "Public libraries are established for the information needs of the wider community.", "medium"],
  ["Why is a national library described as a national depository?", "It seeks to preserve the nation's published and unpublished documentary output", ["It stores only foreign novels", "It lends every archival item", "It serves one company department"], "Depository responsibility supports comprehensive national collection and preservation.", "medium"],
  ["Which library role transmits recorded knowledge from one generation to another?", "Custodial role", ["Commercial role", "Manufacturing role", "Athletic role"], "Preservation of recorded knowledge is the library's custodial function.", "medium"],
  ["A library provides dictionaries, manuals and encyclopedias for quick consultation. Which role is most directly demonstrated?", "Information role", ["Construction role", "Transportation role", "Agricultural production role"], "Reference sources help the library supply reliable information.", "medium"],
  ["A community library helps independent learners prepare for external examinations. Which role is illustrated?", "Educational role", ["Custodial role only", "Recreational role only", "Commercial role"], "Libraries extend educational opportunity beyond formal classrooms.", "medium"],
  ["Taking storybooks and cultural materials to rural community centres illustrates which role?", "Recreational and cultural role", ["National-depository role", "Cataloguing role only", "Book-selling role"], "The module associates community reading and cultural activities with recreation.", "medium"],
  ["Why might reference books be kept in a separate department and not loaned?", "To keep high-demand consultation sources continuously available", ["Because they contain no information", "Because only librarians may read them", "To prevent users from consulting them"], "Non-circulating reference collections remain available to many users for specific enquiries.", "medium"],
  ["A university library designs services for students but ignores faculty research and teaching. Which part of its academic role is deficient?", "Support for the full parent institution", ["National legal deposit", "Public taxation", "Primary-school curriculum support"], "An academic library must serve students, faculty and staff across teaching, learning and research.", "hard"],
  ["Which pairing is incorrect?", "Special library — unrestricted general service to every resident", ["Academic library — postsecondary institution", "School library — pupils and teachers", "National library — national documentary heritage"], "Unrestricted community service describes a public library, not a focused special library.", "hard"],
  ["What is legal deposit?", "A requirement to submit specified publications to designated libraries", ["A fine paid for every library visit", "A method of shelving fiction", "A loan between two students"], "Legal deposit helps national or designated libraries preserve a country's publishing output.", "easy", G],
  ["Which service lets one library obtain an item from another library for its user?", "Interlibrary loan", ["Legal deposit", "Shelf reading", "Book accessioning"], "Interlibrary loan extends access beyond one institution's local collection.", "medium", G],
  ["A public library has limited funds. Which decision best reflects equitable service?", "Use community evidence to prioritize resources while preserving access for underserved groups", ["Buy only materials requested by the wealthiest users", "Exclude users without personal computers", "Spend the entire budget on one rare item without assessment"], "Evidence-based and inclusive allocation balances demand with equitable access.", "hard", G],
  ["Which measure best evaluates whether an academic library supports learning?", "Combine usage evidence with student outcomes and user feedback", ["Count the building's windows only", "Measure shelf length without considering use", "Assume collection size alone proves impact"], "Meaningful assessment uses multiple indicators of access, experience and educational value.", "hard", G],
]);

// 3. Catalogues and cataloguing (20)
addTopic("Catalogues and Cataloguing", "GNS 113 module, Study Session 3", [
  ["What is a library catalogue?", "A record or list of materials held by a library", ["A list of books sold by publishers only", "A register of library visitors", "A schedule of staff salaries"], "The catalogue is a key or pointer to a library's holdings.", "easy"],
  ["What is a union catalogue?", "A catalogue covering the holdings of multiple libraries", ["A catalogue of one shelf only", "A list of staff unions", "A catalogue containing fiction only"], "A union catalogue brings together records from more than one library.", "easy"],
  ["What does OPAC stand for?", "Online Public Access Catalogue", ["Open Printed Author Card", "Official Publication Access Code", "Online Private Archive Collection"], "OPAC is the computerized public interface to catalogue records.", "easy"],
  ["Which catalogue uses separate physical cards filed in drawers?", "Card catalogue", ["OPAC", "Digital repository", "Electronic database"], "A card catalogue stores individual entries on cards in a cabinet.", "easy"],
  ["What is the standard card size stated in the module?", "5 × 3 inches", ["8 × 5 inches", "10 × 7 inches", "12 × 9 inches"], "The module gives 5 by 3 inches, approximately 12.5 by 7.5 centimetres.", "easy"],
  ["Which catalogue access point is most useful when the author and title are unknown but the topic is known?", "Subject catalogue", ["Author catalogue", "Accession register", "Borrowers' register"], "Subject entries lead users to materials about a known topic.", "easy"],
  ["A student knows only an author's surname. Which catalogue approach should be used first?", "Author/title catalogue", ["Subject catalogue only", "Shelf list only", "Serials control register"], "Author entries are arranged alphabetically, normally by surname.", "medium"],
  ["What can a user commonly discover through an OPAC?", "Whether an item is held, its status and location", ["The private salary of each librarian", "The full text of every book automatically", "Only the colour of the library building"], "An OPAC supports searching and displays bibliographic, location and availability information.", "medium"],
  ["Which catalogue is normally arranged in the same order as books on the shelves?", "Shelf list", ["Author/title catalogue", "Subject catalogue", "Dictionary catalogue"], "Shelf-list entries follow call marks and shelf arrangement.", "medium"],
  ["Why is the shelf list mainly a staff working tool?", "It supports collection control in shelf order", ["It contains no records", "It is a list of staff names", "It replaces every public access point"], "The shelf list mirrors physical arrangement and aids inventory and collection management.", "medium"],
  ["Which type of cataloguing describes author, title, edition and publication details?", "Descriptive cataloguing", ["Subject cataloguing only", "Book circulation", "Reference interviewing"], "Descriptive cataloguing records the bibliographic characteristics of an item.", "medium"],
  ["Which cataloguing activity identifies what a work is about?", "Subject cataloguing", ["Descriptive pagination", "Charging out", "Shelf cleaning"], "Subject cataloguing assigns subject headings or classifications representing content.", "medium"],
  ["Which set contains cataloguing tools named in the module?", "AACR, Library of Congress Subject Headings and Sears List", ["DDC, a calculator and a printer only", "ISBN, DOI and a borrower card only", "Atlas, yearbook and gazetteer"], "The module names AACR, LCSH and Sears subject headings as cataloguing tools.", "medium"],
  ["What does the imprint area of a catalogue record normally contain?", "Place, publisher and date of publication", ["Only the author's birth date", "The user's loan history", "The shelf's physical dimensions"], "Imprint records publication place, publisher and date.", "medium"],
  ["A search for 'automobiles' points to the authorized heading 'cars.' Which cross-reference is appropriate?", "See reference", ["See also reference", "Shelf-list reference", "Accession reference"], "A See reference redirects from an unused term to the authorized term.", "hard"],
  ["A catalogue links the valid heading 'education' to the related valid heading 'teaching.' Which device is used?", "See also reference", ["See reference", "Imprint statement", "Collation note"], "See also connects related headings that are both used in the catalogue.", "hard"],
  ["What is a discovery layer?", "A search interface combining records from several library resources", ["A physical shelf above another shelf", "A bookbinding material", "A rule banning database searches"], "Discovery systems provide a unified search across catalogues, databases and repositories.", "easy", G],
  ["Which metadata field most directly identifies the entity responsible for creating a work?", "Creator or author", ["File size", "Loan period", "Shelf height"], "Creator metadata supports identification and retrieval by responsibility.", "medium", G],
  ["Two catalogue records describe the same edition under slightly different punctuation. What is the best data-quality action?", "Compare identifiers and edition details, then merge confirmed duplicates", ["Delete both records immediately", "Keep every duplicate without review", "Change the authors to match"], "Controlled deduplication preserves one accurate record while avoiding accidental loss.", "hard", G],
  ["Why are authority-controlled names useful in a catalogue?", "They bring variant forms of a name under a consistent access point", ["They hide all works by an author", "They eliminate the need for searching", "They arrange books by colour"], "Authority control connects name variants and improves consistent retrieval.", "hard", G],
]);

// 4. Classification schemes and call numbers (20)
addTopic("Classification Schemes and Call Numbers", "GNS 113 module, Study Session 3", [
  ["What does library classification primarily do?", "Groups materials according to subject", ["Arranges users by age", "Lists books by price", "Sorts buildings by size"], "Classification brings resources on the same or related subjects together.", "easy"],
  ["Which scheme divides knowledge into ten main numeric classes?", "Dewey Decimal Classification", ["Library of Congress Classification", "Colon Classification only", "Sears List of Subject Headings"], "DDC uses ten main classes numbered from 000 to 999.", "easy"],
  ["Which scheme uses letters for its main classes?", "Library of Congress Classification", ["Dewey Decimal Classification", "A dictionary catalogue", "An accession register"], "LCC denotes its broad subject classes with letters.", "easy"],
  ["In Dewey Decimal Classification, which range represents social sciences?", "300–399", ["100–199", "500–599", "800–899"], "The 300 class covers social sciences.", "easy"],
  ["In Dewey Decimal Classification, which range represents literature?", "800–899", ["200–299", "400–499", "600–699"], "The 800 class is assigned to literature.", "easy"],
  ["In Library of Congress Classification, which letter represents science?", "Q", ["H", "P", "Z"], "The module's LCC outline assigns Q to science.", "easy"],
  ["Which DDC class is used for philosophy?", "100–199", ["000–099", "400–499", "900–999"], "Philosophy occupies the 100 main class.", "medium"],
  ["Which DDC class covers technology or applied sciences?", "600–699", ["300–399", "500–599", "700–799"], "The 600 class covers technology and applied sciences.", "medium"],
  ["Which DDC range combines history and geography?", "900–999", ["200–299", "500–599", "800–899"], "History and geography are placed in the 900 class.", "medium"],
  ["Which LCC letter represents language and literature?", "P", ["G", "K", "R"], "P is the broad LCC class for language and literature.", "medium"],
  ["Which LCC letter represents law?", "K", ["L", "M", "N"], "K is assigned to law in LCC.", "medium"],
  ["Which LCC letter represents library science and bibliography?", "Z", ["A", "Q", "T"], "Z covers bibliography, library science and general information resources.", "medium"],
  ["Why does a classification scheme use progressively specific subdivisions?", "To place broad subjects and narrower topics in a logical hierarchy", ["To make every book share one number", "To remove subject relationships", "To arrange items randomly"], "Hierarchical notation moves from general classes to more specific subjects.", "medium"],
  ["What is the main practical purpose of the call number on a book?", "To identify its classified shelf location", ["To state its selling price", "To record the borrower's phone number", "To replace the book's title"], "A call number links the catalogue record to the item's physical position.", "medium"],
  ["A user wants books on medicine. Which pairing correctly identifies likely broad classes?", "DDC 610s and LCC R", ["DDC 800s and LCC P", "DDC 300s and LCC K", "DDC 000s and LCC M"], "Medicine falls within DDC 610 and the LCC R class.", "hard"],
  ["Why can two books on the same subject have similar classification numbers but different complete call numbers?", "Author or item marks distinguish works within the same subject", ["Classification ignores subject", "Every title must receive an unrelated main class", "The shelf location is based only on colour"], "The class portion collocates the subject, while cutter and date elements distinguish individual works.", "hard"],
  ["What is a faceted classification system?", "A system that combines separate characteristics of a subject", ["A system that uses book colour only", "A catalogue with no subjects", "A list of overdue borrowers"], "Facets represent dimensions such as topic, place, time or form and can be combined.", "easy", G],
  ["What does a cutter number commonly help represent in a call number?", "The author or title for item arrangement", ["The library's electricity bill", "The number of pages borrowed", "The user's registration year"], "Cutter notation alphabetically distinguishes works within a class.", "medium", G],
  ["A new interdisciplinary book could reasonably fit two classes. What is the best classification decision?", "Choose the class matching its dominant subject and local user needs, then add subject access points", ["Assign no class at all", "Place it randomly each day", "Create several physical copies without records"], "Classification requires consistent judgment while subject headings preserve alternative access.", "hard", G],
  ["A library changes classification schemes. What is the greatest operational risk if catalogue and spine labels are not updated together?", "Catalogue locations will no longer match shelf locations", ["Every book's text will change", "All authors will lose copyright", "The building will become smaller"], "Successful reclassification requires synchronized records, labels and shelf order.", "hard", G],
]);

// 5. Locating and retrieving library materials (20)
addTopic("Locating and Retrieving Library Materials", "GNS 113 module, Study Session 4", [
  ["What should a user normally consult first when searching for a library book?", "The library catalogue", ["The staff salary register", "The cafeteria menu", "A random shelf"], "The catalogue identifies whether the library holds an item and where it is located.", "easy"],
  ["If the author is known, which catalogue access point is most direct?", "Author entry", ["Subject entry only", "Documents catalogue only", "Serials issue register"], "Author entries allow retrieval by the creator's name.", "easy"],
  ["If neither author nor title is known but the topic is known, which search should be used?", "Subject search", ["Borrower-name search", "Publisher-price search", "Shelf-colour search"], "A subject search retrieves works about the topic.", "easy"],
  ["Where is a book's classification or call number commonly displayed physically?", "On the book's spine label", ["Only inside the librarian's office", "On the borrower's card", "On the library entrance"], "The spine label supports matching the book with its shelf location.", "easy"],
  ["How is the serials catalogue commonly arranged according to the module?", "Alphabetically by title", ["By borrower surname", "By book height", "By purchase price only"], "Serial records are commonly filed by serial title, sometimes by issuing body.", "easy"],
  ["How is the documents catalogue commonly arranged?", "By issuing body and title", ["By paper colour", "By reader age", "By date borrowed only"], "Government or organizational documents are retrieved through the responsible issuing body and title.", "easy"],
  ["A catalogue search shows a call number and status 'available.' What should the user do next?", "Note the call number and follow shelf guides to that location", ["Assume the book is online full text", "Search only by book colour", "Leave without checking the shelf"], "The call number maps the catalogue result to the organized shelf sequence.", "medium"],
  ["A title appears in the catalogue but has status 'on loan.' What does this mean?", "The library owns it, but a borrower currently has it", ["The title has never been acquired", "It is permanently missing", "It must be a journal article"], "Loan status distinguishes ownership from current physical availability.", "medium"],
  ["Why should a user copy the complete call number rather than only the main class?", "The remaining elements identify the precise item and order", ["The main class is never used", "Call numbers contain the book's full text", "Only the date matters on shelves"], "Class, subclass, cutter and date together locate a specific work.", "medium"],
  ["Several books share the same subject class. What usually determines their sequence within that class?", "The remaining call-number elements", ["The order in which users return them", "The colour of their covers", "The price of each book"], "Cutter numbers, dates and other notation create a predictable local order.", "medium"],
  ["A user knows a journal's title but not a particular article author. Which catalogue is most appropriate to confirm the library holds the journal?", "Serials catalogue", ["Subject card for books only", "Borrowers' register", "Shelf list of furniture"], "The serials catalogue records journals and other continuing publications.", "medium"],
  ["A student wants all materials the library holds on renewable energy. Which access point gives the broadest starting set?", "Subject catalogue or subject search", ["One known-author card only", "The documents catalogue by issuing body only", "A random shelf label"], "Subject access collocates works by topic across different authors and titles.", "medium"],
  ["Why are shelf guides useful?", "They connect classification ranges to physical shelf areas", ["They replace catalogue records entirely", "They list only overdue fines", "They prevent books from being classified"], "Shelf signage helps users navigate from a call number to the appropriate range.", "medium"],
  ["A book is not in its expected position although the catalogue says available. What is the best next action?", "Check nearby shelves and then ask library staff to trace it", ["Mark it permanently lost immediately", "Alter the catalogue record yourself", "Take a different book without recording it"], "Items may be misshelved or in temporary use; systematic checking and staff assistance are appropriate.", "medium"],
  ["A student searches a broad subject term and gets hundreds of records. Which strategy best narrows the results without losing relevance?", "Add a more specific subject term and use available filters", ["Remove every search term", "Sort only by cover colour", "Search the student's name"], "Specific concepts plus date, format or subject filters improve precision.", "hard"],
  ["The catalogue lists the same title in print and electronic formats. Which evidence should guide the choice?", "Availability, access rights and the user's task", ["Assume both records are errors", "Choose whichever record appears last", "Ignore format and access information"], "Format-specific records may represent legitimate editions with different access conditions.", "hard"],
  ["What does a library hold request normally do?", "Reserves an item for a user when it becomes available", ["Transfers ownership permanently", "Deletes the catalogue record", "Waives every library rule"], "A hold places the user in a queue or sets aside an available item for collection.", "easy", G],
  ["What is a permalink in a library database?", "A stable link intended to return to a specific record or item", ["A temporary browser-session address only", "A call number printed on a spine", "A password shared by all users"], "Permalinks support reliable return and citation, unlike many session-based URLs.", "medium", G],
  ["A database result says 'no full text,' but gives a complete citation. What is the best next step?", "Search the title in other library tools or request document delivery", ["Conclude the work does not exist", "Invent the missing text", "Cite it without checking relevance"], "A citation can be used to locate access through catalogues, databases, repositories or interlibrary services.", "hard", G],
  ["A search retrieves many results containing one word in unrelated contexts. Which action best improves precision?", "Use a phrase search or combine the term with a second concept using AND", ["Add unrelated OR terms indefinitely", "Search every word separately", "Remove the central concept"], "Phrase searching and Boolean AND reduce irrelevant matches.", "hard", G],
]);

// 6. Reference sources and services (20)
addTopic("Reference Sources and Services", "GNS 113 module, Study Session 5", [
  ["How is a reference book normally used?", "For consultation on specific information", ["It must always be read cover to cover", "It is used only as fiction", "It contains no organized entries"], "Reference works are designed for quick consultation rather than continuous reading.", "easy"],
  ["Which reference source is best for word meanings and pronunciation?", "Dictionary", ["Atlas", "Yearbook", "Directory"], "Dictionaries provide spelling, meaning, pronunciation and usage information.", "easy"],
  ["Which reference source gives authoritative overview articles on many topics?", "Encyclopedia", ["Telephone directory", "Atlas only", "Borrowers' register"], "An encyclopedia summarizes topics for rapid consultation.", "easy"],
  ["Which source is primarily a collection of maps?", "Atlas", ["Dictionary", "Yearbook", "Manual"], "Atlases contain maps, often with place-name indexes.", "easy"],
  ["Which source lists people or organizations with contact details?", "Directory", ["Gazetteer", "Encyclopedia", "Abstract"], "Directories provide brief identifying and contact information.", "easy"],
  ["Which publication usually summarizes events and statistics from a particular year?", "Yearbook", ["Dictionary", "Atlas", "Catalogue card"], "A yearbook is issued annually and records events or data for the preceding year.", "easy"],
  ["A student needs concise instructions for operating laboratory equipment. Which source is most suitable?", "Manual", ["Biographical dictionary", "Atlas", "Yearbook"], "Manuals give practical rules and step-by-step operating instructions.", "medium"],
  ["Which source would best provide latitude, longitude and brief information about a place?", "Gazetteer", ["Thesaurus", "Yearbook", "Handbook"], "Gazetteers identify geographic names and locations.", "medium"],
  ["A researcher wants key facts about a notable person's life, education and career. Which source should be consulted?", "Biographical dictionary", ["Language dictionary", "Atlas", "Serials catalogue"], "Biographical dictionaries compile concise information about people.", "medium"],
  ["What distinguishes a general reference work from a subject reference work?", "Breadth across fields rather than focus on one discipline", ["General works contain no facts", "Subject works cannot be consulted", "Only general works have indexes"], "General works cover many areas; subject works concentrate on a particular discipline.", "medium"],
  ["Which class of reference sources points users to where information can be found?", "Indexes, abstracts and bibliographies", ["Dictionaries, atlases and yearbooks only", "Novels and plays", "Borrower cards and receipts"], "These bibliographic tools guide users to relevant documents rather than always supplying the final facts.", "medium"],
  ["Why are many reference books kept as non-circulating materials?", "They need to remain available for frequent consultation", ["They have no value outside storage", "Users are forbidden to read them", "They are always unique manuscripts"], "Keeping core reference works in the library supports equitable, dependable access.", "medium"],
  ["A user asks for the current address of a professional association. Which reference source is the best first choice?", "Directory", ["Historical atlas", "Etymological dictionary", "Novel"], "Directories are designed to supply organizational names and contact details.", "medium"],
  ["What is the reference interview?", "A librarian's process of clarifying a user's information need", ["An examination for overdue borrowers", "A publisher's sales meeting", "A method of binding books"], "Clarifying purpose, scope and constraints helps the librarian provide an appropriate answer or source.", "medium"],
  ["A user asks for a brief explanation of a scientific concept and sources for further reading. Which combination is strongest?", "A subject encyclopedia followed by its bibliography", ["A telephone directory alone", "A road atlas alone", "A circulation receipt"], "The encyclopedia supplies an overview, while references lead to deeper sources.", "hard"],
  ["A question asks both the historical population of a country and its geographic coordinates. Which pair is most appropriate?", "A statistical yearbook and a gazetteer", ["A language dictionary and a manual", "An atlas and a novel", "A directory and a thesaurus only"], "Yearbooks provide time-specific statistics; gazetteers locate named places geographically.", "hard"],
  ["What is a tertiary information source?", "A source that summarizes or organizes information from primary and secondary sources", ["An original laboratory notebook only", "A raw interview recording only", "An unpublished dataset only"], "Encyclopedias and similar tools synthesize existing knowledge for overview and access.", "easy", G],
  ["Which source is most appropriate for a quick overview before searching research articles?", "A reputable subject encyclopedia", ["An anonymous social-media comment", "A random advertisement", "A circulation notice"], "A subject encyclopedia helps establish vocabulary and background for deeper research.", "medium", G],
  ["Two online reference sources disagree on a statistic. What is the best response?", "Check publication dates, methods and the original authoritative source", ["Use whichever figure is larger", "Average them without investigation", "Cite both as equally current"], "Source evaluation and verification are necessary when reference information conflicts.", "hard", G],
  ["A user asks a health question with serious consequences. What should a reference librarian do?", "Provide authoritative sources while clarifying that information is not personal medical diagnosis", ["Give an unsupported diagnosis", "Use the first anonymous webpage", "Hide all available information"], "High-stakes reference service requires authoritative evidence, scope clarification and appropriate professional boundaries.", "hard", G],
]);

// 7. Guides to published information and bibliographic skills (20)
addTopic("Guides to Published Information and Bibliographic Skills", "GNS 113 module, Study Session 6", [
  ["What is a bibliography?", "A systematic list of books or other materials sharing defined characteristics", ["A summary of one paragraph only", "A map index", "A list of library fines"], "A bibliography lists works by an author, on a subject or sharing features such as language, period or place.", "easy"],
  ["What is the person who compiles a bibliography called?", "Bibliographer", ["Biographer", "Lexicographer", "Cartographer"], "A bibliographer prepares or compiles bibliographies.", "easy"],
  ["What is an index?", "An arranged list of headings with pointers to where they occur", ["A full reproduction of every source", "A list of borrowers", "A narrative history without access points"], "Indexes direct readers to names, places or subjects and their locations in a work.", "easy"],
  ["What is an abstract?", "A brief objective summary of a work's essential content", ["A complete copy of the work", "An alphabetical list of page numbers only", "A publisher's address list"], "An abstract communicates a document's main points concisely.", "easy"],
  ["Where is the index usually placed in a single-volume nonfiction book?", "Near the end of the book", ["Before the title page", "On the front cover only", "Between every paragraph"], "A book index normally follows the main text and related end matter.", "easy"],
  ["Where does an abstract normally appear in a scholarly journal article?", "After the title and authors but before the main text", ["Only after the references", "Inside the journal cover", "It replaces the article title"], "The abstract precedes the article body and summarizes its content.", "easy"],
  ["A lecturer gives an incomplete book citation. Which guide can help verify whether the work exists and supply publication details?", "A suitable bibliography or library catalogue", ["A road atlas", "A telephone directory", "A borrower's card"], "Bibliographic tools help identify and verify published works.", "medium"],
  ["A researcher wants to know everything listed by a particular author. Which type of bibliography is most relevant?", "Author bibliography", ["Geographic gazetteer", "Language dictionary", "Shelf guide"], "An author bibliography brings together works associated with a named creator.", "medium"],
  ["What distinguishes a selective bibliography from a comprehensive one?", "It includes chosen works according to stated criteria", ["It has no organizing principle", "It must contain every work ever published", "It lists page numbers within one book only"], "Selection limits coverage by quality, date, audience or another explicit scope.", "medium"],
  ["A student needs the pages where 'climate change' appears in a textbook. Which tool is most direct?", "The book's index", ["The title page", "A directory", "The circulation register"], "The index maps subject headings to relevant page numbers.", "medium"],
  ["A database record supplies a short summary but not the complete article. What has it supplied?", "An abstract", ["A full text", "A shelf list", "A gazetteer"], "An abstract summarizes an article without reproducing the whole document.", "medium"],
  ["Why are works of fiction less commonly indexed than scholarly nonfiction?", "They are usually read as continuous narratives rather than consulted by topics", ["Fiction contains no words", "Indexes are illegal in novels", "Fiction cannot have page numbers"], "Topical indexes are most useful for works consulted selectively.", "medium"],
  ["What is an informative abstract intended to include?", "The main purpose, methods, results and conclusions", ["Only the author's address", "A list of unrelated books", "Every sentence from the original"], "An informative abstract communicates the essential substance of the study.", "medium"],
  ["What is an indicative abstract mainly designed to do?", "Describe the scope and topics without reporting full findings", ["Replace the entire publication", "List borrower names", "Give geographic coordinates"], "An indicative abstract signals what the work covers so readers can judge relevance.", "medium"],
  ["A bibliography lists a journal article but omits volume, issue, pages and DOI. Why is verification difficult?", "The citation lacks details needed to distinguish and locate the article", ["Article titles are never searchable", "Journal articles have no authors", "A DOI is the only valid citation element"], "Complete bibliographic elements improve identification and retrieval.", "hard"],
  ["A student treats an abstract as proof of a paper's detailed methodology. What is the main problem?", "An abstract may omit limitations and methodological detail found in the full text", ["Abstracts are always fictional", "The title contains more methods than the article", "Full texts never explain methods"], "Abstracts support relevance screening but rarely replace critical reading of the complete study.", "hard"],
  ["What is a DOI?", "A persistent identifier assigned to a digital scholarly object", ["A temporary library password", "A physical shelf mark only", "A book's selling price"], "A Digital Object Identifier helps reliably identify and link to an article or other object.", "easy", G],
  ["Which information is normally essential when citing a journal article?", "Author, article title, journal, year and publication details", ["Only the colour of the webpage", "The borrower's name", "The library opening time"], "A usable citation identifies both the work and the container in which it was published.", "medium", G],
  ["A DOI link fails, but the DOI string is available. What is the strongest recovery strategy?", "Search the DOI through a resolver or scholarly search tool", ["Assume the article was never published", "Invent a replacement DOI", "Remove the source from the bibliography without checking"], "Persistent identifiers can be resolved or searched even when one hyperlink implementation fails.", "hard", G],
  ["A citation generator produces a polished reference with the wrong author. What should the student do?", "Correct it against the original source metadata", ["Keep it because formatting tools cannot err", "Replace the author with the student's name", "Delete every citation"], "Automated citation output must be verified for bibliographic accuracy.", "hard", G],
]);

// 8. Current awareness and research discovery (20)
addTopic("Current Awareness and Research Discovery", "GNS 113 module, Study Session 7", [
  ["What is the main purpose of a current-awareness service?", "To alert users quickly to recent information in their fields", ["To replace every older publication", "To collect library fines", "To classify furniture"], "Current-awareness services expose users to newly available and recently published information.", "easy"],
  ["According to the module, current-awareness service is closely associated with what term?", "Selective Dissemination of Information", ["Retrospective Conversion of Records", "Interlibrary Shelving", "Document Binding Service"], "The module links current awareness with Selective Dissemination of Information, often abbreviated SDI.", "easy"],
  ["Which users commonly benefit from a current-awareness profile?", "Individuals or groups with defined subject interests", ["Only people with no information needs", "Publishers' delivery drivers", "Library furniture suppliers"], "Services can be tailored to a researcher's or group's interest profile.", "easy"],
  ["What does a Current Contents service reproduce?", "Tables of contents from recent journals", ["Every library user's loan record", "Complete textbooks only", "The national census"], "Contents-page reproduction lets researchers scan newly published articles quickly.", "easy"],
  ["How often did the module describe the Current Contents series as appearing?", "Weekly", ["Once every ten years", "Hourly", "Only when a library closes"], "The cited Current Contents sections were issued weekly.", "easy"],
  ["What is a review journal primarily devoted to publishing?", "Evaluations of new books and other publications", ["Raw circulation statistics", "Only classified advertisements", "Shelf numbers without reviews"], "Review journals publish signed evaluative accounts of new works.", "easy"],
  ["Why are journal tables of contents useful for current awareness?", "They reveal new article titles before conventional indexes may be updated", ["They guarantee every article is correct", "They replace the complete articles", "They contain no bibliographic information"], "Scanning contents pages shortens the delay in discovering new literature.", "medium"],
  ["How does an interest profile improve selective dissemination?", "It matches alerts to the user's subjects and needs", ["It sends every user identical unrelated material", "It removes all recent publications", "It limits searching to one author forever"], "A profile improves relevance by specifying topics, authors, journals or other preferences.", "medium"],
  ["What is the main benefit of a review journal to a potential reader?", "It helps the reader judge whether a publication is worth consulting", ["It supplies a borrower's password", "It guarantees the reviewed work is available", "It replaces the book permanently"], "A review summarizes and critically assesses a new publication.", "medium"],
  ["How can review journals assist library collection development?", "They provide evaluations that inform selection decisions", ["They automatically purchase every book", "They eliminate budget constraints", "They classify all books by size"], "Professional reviews help librarians assess quality, relevance and audience.", "medium"],
  ["A medical researcher needs immediate notice of articles on one narrow disease. Which service is most suitable?", "A tailored SDI or database alert", ["A general atlas", "An annual yearbook only", "A random shelf search"], "A targeted alert continuously matches new records against a precise interest profile.", "medium"],
  ["Which feature makes current-awareness service especially important in a special library?", "Users often need recent information in a focused field", ["Special libraries contain no current publications", "Their users never conduct research", "They cannot distribute alerts"], "Focused organizations depend on timely specialist information for decisions and research.", "medium"],
  ["What is the difference between a book review and an abstract?", "A review evaluates; an abstract mainly summarizes", ["An abstract evaluates while a review only lists pages", "They are always identical", "Neither describes content"], "Reviews contain critical judgment, whereas abstracts primarily represent the source concisely.", "medium"],
  ["Why should a current-awareness alert include enough citation information?", "So users can identify and retrieve the announced item", ["So it can replace the item's content", "To hide the publication source", "To prevent users from following it"], "Actionable alerts need reliable metadata or links to the underlying publication.", "medium"],
  ["A weekly alert returns 500 mostly irrelevant records. What is the best improvement?", "Refine the interest profile with focused terms, exclusions and source limits", ["Increase the alert to every database record", "Delete all subject terms", "Stop checking relevance"], "A more precise profile reduces noise while preserving timely discovery.", "hard"],
  ["A review praises a book but was written by its publisher without disclosure. Which concern is strongest?", "Potential conflict of interest", ["The review contains a title", "The book has an ISBN", "The review is recent"], "Undisclosed commercial involvement can compromise the independence of evaluation.", "hard"],
  ["What is an RSS feed?", "A subscribable stream of updates from a website or publication", ["A library classification number", "A printed borrower's ticket", "A method of book repair"], "RSS can deliver new posts, issues or search updates to a feed reader.", "easy", G],
  ["What does a saved-search alert in a database do?", "Reruns a query periodically and notifies the user of new matches", ["Deletes old results automatically", "Downloads every article illegally", "Changes article authors"], "Saved alerts automate current discovery using the user's search strategy.", "medium", G],
  ["A researcher needs the newest systematic reviews, not every new mention. Which alert design is best?", "Combine the topic with publication-type filters and a suitable date limit", ["Use only the word research", "Add many unrelated OR terms", "Remove the topic entirely"], "Structured filters align the alert with the evidence type and recency required.", "hard", G],
  ["Why should a researcher periodically review a long-running alert strategy?", "Terminology, databases and research interests can change", ["Search terms never change meaning", "Alerts become legally invalid after one week", "Every new article uses identical vocabulary"], "Updating the profile maintains recall and precision as a field evolves.", "hard", G],
]);

// 9. Library rules, responsible use and information ethics (20)
addTopic("Library Rules, Responsible Use and Information Ethics", "GNS 113 module, Study Session 8", [
  ["Who does the module state may use library facilities?", "Registered users and students", ["Anyone removing materials without registration", "Only publishers", "Only library vendors"], "Registration establishes authorized access and accountability.", "easy"],
  ["What document may be issued to a registered user for borrowing access?", "Library or borrower's card", ["A publishing licence", "A catalogue drawer", "A bookshop receipt"], "A borrower's card identifies an authorized library user.", "easy"],
  ["What behaviour does the module require inside the library?", "Maintaining silence", ["Playing loud music", "Smoking near shelves", "Eating over books"], "Quiet conduct supports study and avoids disturbing other users.", "easy"],
  ["What should be done with books consulted inside the library?", "Leave them on the reading table for staff", ["Hide them on another shelf", "Take them home without charging", "Write notes inside them"], "Staff can reshelve consulted items correctly and record use where needed.", "easy"],
  ["What must happen before a circulating item leaves the library?", "It must be properly charged out", ["Its catalogue record must be deleted", "Its call number must be removed", "It must be marked by the user"], "Charging records the loan and establishes responsibility for return.", "easy"],
  ["Which materials does the module say should not be removed from the library?", "Reference, serial and reserved materials", ["Every circulating textbook", "The user's personal notebook", "All photocopies"], "High-demand or consultation collections are designated for in-library use.", "easy"],
  ["Why are overdue fines imposed?", "To encourage timely return and fair access", ["To increase the book's page count", "To change its subject", "To replace registration"], "Keeping items beyond their due date prevents other users from accessing them.", "medium"],
  ["A student marks important paragraphs in a library textbook. Which rule is violated?", "Do not mark library materials", ["Maintain silence", "Deposit luggage", "Use the subject catalogue"], "Writing, highlighting or defacing shared resources damages them for others.", "medium"],
  ["Why should large bags be deposited at the designated area?", "To support security and safe use of library space", ["To catalogue the bags as books", "To transfer ownership to the library", "To prevent the user from reading"], "Controlled bag storage reduces obstruction and unauthorized removal risks.", "medium"],
  ["A user returns a book by placing it randomly on a shelf. What problem can this create?", "The book may become effectively lost through misshelving", ["Its text will automatically change", "The author will lose authorship", "Its ISBN will expire"], "A misshelved item may be unavailable even though the catalogue says it is present.", "medium"],
  ["Why are naked flames prohibited in libraries?", "They create a serious fire risk to people and collections", ["They improve preservation too quickly", "They interfere with classification letters", "They change books into e-resources"], "Paper collections and furnishings are highly vulnerable to fire.", "medium"],
  ["A user lends a personal borrower's card to a friend. What is the main accountability problem?", "Loans may be recorded against the wrong person", ["The catalogue gains new subjects", "The friend's books become reference works", "The library becomes a bookshop"], "Library credentials should identify the actual responsible borrower.", "medium"],
  ["Why are food and drinks commonly restricted around collections?", "Spills and pests can damage materials and equipment", ["Food changes every call number", "Readers cannot think after eating", "Libraries contain no waste bins"], "Preventive rules protect shared resources and the study environment.", "medium"],
  ["A reserved book is urgently needed outside the library. What is the responsible action?", "Ask staff whether an authorized short-loan option exists", ["Remove it secretly", "Erase its reserve label", "Substitute a borrower's card without permission"], "Users should follow the service policy rather than bypass controls on scarce material.", "medium"],
  ["A user accidentally damages a book and hides it. Which response would better protect access and accountability?", "Report the damage promptly so staff can assess repair or replacement", ["Return it anonymously to another shelf", "Remove more pages to conceal it", "Delete its catalogue record"], "Early reporting supports preservation and fair resolution.", "hard"],
  ["A library introduces quiet phone zones instead of a total phone ban. Which principle best explains the change while respecting the module's aim?", "Control disruption while adapting the rule to current learning needs", ["Abandon all conduct standards", "Permit calls everywhere at maximum volume", "Prohibit digital learning entirely"], "The stable objective is an effective study environment; implementation can evolve with technology.", "hard"],
  ["What is plagiarism?", "Presenting another person's words or ideas as one's own without proper acknowledgement", ["Using a catalogue to find a book", "Writing an original summary with citation", "Borrowing a book through the circulation desk"], "Plagiarism misrepresents intellectual authorship.", "easy", G],
  ["What is the most responsible way to use a quotation in an assignment?", "Use quotation marks and cite the source", ["Remove the author's name", "Change one word and provide no citation", "Copy it into several assignments without attribution"], "Direct wording requires clear quotation and bibliographic acknowledgement.", "medium", G],
  ["A student uploads a copyrighted textbook to a public group because the library owns one copy. What is the key problem?", "Ownership of a copy does not automatically grant redistribution rights", ["Digital files cannot have copyright", "Library books must always be public domain", "Citations transfer copyright ownership"], "Access rights and copyright permissions remain distinct from physical ownership.", "hard", G],
  ["A database records users' health-related searches. Which ethical safeguard is most important?", "Limit collection and protect confidentiality with appropriate access controls", ["Publish each user's history", "Retain all data forever without purpose", "Share credentials between patrons"], "Privacy-conscious services minimize sensitive data and restrict authorized use.", "hard", G],
]);

// 10. ICT, automation, electronic resources and information literacy (20)
addTopic("ICT, Automation, Electronic Resources and Information Literacy", "GNS 113 module, Study Session 9", [
  ["How does the module define ICT broadly?", "Technology for acquiring, processing, storing and disseminating information", ["A method of shelving by colour", "A printed dictionary only", "A rule against communication"], "ICT combines computing, software, telecommunications and digital electronics for information handling.", "easy"],
  ["Which computer component executes instructions and controls processing?", "Central processing unit", ["Printer", "Scanner glass", "External book shelf"], "The CPU performs processing and coordinates computer operations.", "easy"],
  ["Which device is an input device?", "Scanner", ["Printer", "Monitor", "Projector"], "A scanner captures data into the computer system.", "easy"],
  ["Which device is an output device?", "Printer", ["Keyboard", "Mouse", "Scanner"], "A printer produces output from processed computer data.", "easy"],
  ["What is operating-system software?", "The master software that manages hardware and other programs", ["A catalogue card", "A printed manual only", "A library building component"], "The operating system controls core computer functions and supports applications.", "easy"],
  ["What is library automation?", "Using computers and ICT to perform library operations and services", ["Replacing all users with machines", "Turning every print book into fiction", "Arranging shelves without records"], "Automation applies ICT to acquisition, cataloguing, circulation, serials and reference work.", "easy"],
  ["Which library operation can be automated?", "Circulation", ["A reader's private thoughts", "The physical authorship of books", "The historical publication date"], "Automated circulation systems record loans, returns, renewals and borrower status.", "medium"],
  ["Which is an example of library application software named in the module?", "KOHA", ["A paper atlas", "A borrower card", "A shelf label"], "KOHA is an integrated library-management application.", "medium"],
  ["How can automation reduce duplication of records?", "Shared structured data can be searched before a new record is created", ["It removes all identifiers", "It prevents staff from viewing records", "It creates a new record for every search"], "Searchable databases support reuse and deduplication of bibliographic records.", "medium"],
  ["Which challenge can hinder library automation in a developing environment?", "Irregular electricity supply", ["Alphabetical order", "Trained users", "Accurate records"], "Power instability affects computers, networks and access to electronic services.", "medium"],
  ["What is an electronic library?", "A library providing resources in electronic formats", ["A room containing electricity but no information", "A catalogue of printed books only", "A bookshop selling computers"], "Electronic libraries provide digital or electronically accessed information resources.", "medium"],
  ["Which advantage allows several users to consult an e-resource from different places?", "Multiple remote access", ["One-person physical control", "Absence of search functions", "Permanent dependence on one shelf"], "Licensed digital resources can support simultaneous or distributed access.", "medium"],
  ["Which is a disadvantage of electronic resources identified in the module?", "Power failure can interrupt access", ["They can never be searched", "They require no equipment", "They occupy more shelf space than print"], "Electronic access depends on functioning devices, power and often networks.", "medium"],
  ["Which database named in the module focuses on open-access journals?", "DOAJ", ["AACR", "DDC", "OPAC card drawer"], "DOAJ stands for Directory of Open Access Journals.", "medium"],
  ["A library scans old catalogue cards but does not verify or structure the data. Why may retrieval remain poor?", "Digitization alone does not ensure accurate searchable metadata", ["Electronic records cannot be searched", "Card catalogues contain no useful data", "Computers automatically correct every error"], "Effective automation needs clean, structured and quality-controlled records.", "hard"],
  ["A library buys an e-book package but students cannot log in off campus. Which requirement was overlooked?", "Authentication and remote-access design", ["Physical shelf spacing", "Card dimensions", "Bookbinding glue"], "Licensing and identity systems must support the intended access locations.", "hard"],
  ["Which Boolean operator normally narrows a search by requiring both concepts?", "AND", ["OR", "NOT in every context", "NEAR as a universal default"], "AND retrieves records containing both combined concepts.", "easy", G],
  ["Which Boolean operator normally broadens a search by combining synonyms?", "OR", ["AND", "NOT", "EXACT only"], "OR retrieves records containing either synonym or related term.", "medium", G],
  ["A webpage has no author, no evidence and sensational claims. What is the best academic response?", "Treat it cautiously and verify the claim with authoritative sources", ["Cite it as conclusive because it is online", "Assume the newest-looking page is correct", "Share it before checking"], "Authority, evidence, purpose and corroboration are central to information evaluation.", "hard", G],
  ["A search on 'youth unemployment in Nigeria' retrieves too little. Which revision is most likely to improve recall?", "Add synonyms with OR while retaining the main concepts", ["Require every possible term with AND", "Exclude Nigeria", "Search an unrelated phrase"], "A concept-group strategy such as (youth OR adolescents) AND (unemployment OR joblessness) can retrieve variant terminology.", "hard", G],
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
    id: deterministicUuid(`gns113-question-${index + 1}-${question.prompt}`),
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
      import: "codex_gns113_200_v1",
      sourceReference: question.sourceLabel,
      contentAndAnswerCheckCompleted: true,
      humanVerificationRequired: true,
    },
    options: question.options.map((text, optionIndex) => ({
      id: deterministicUuid(`gns113-option-${index + 1}-${optionIndex}-${text}`),
      text,
      isCorrect: optionIndex === question.answerIndex,
      position: optionIndex,
    })),
  }));
}

function renderSql(rows) {
  const payload = JSON.stringify(rows);
  if (payload.includes("$gns113_questions$")) throw new Error("Unexpected SQL dollar tag in generated content.");
  return `-- GNS 113 Exam Sprint: import 200 curated MCQs into an empty private bank
-- Sources: supplied official GNS 113 module plus clearly labelled General GNS 113 enrichment
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
  WHERE upper(regexp_replace(coalesce(course_code, ''), '[^A-Za-z0-9]', '', 'g')) = 'GNS113'
    AND delivery_mode = 'mock_exam'
    AND exam_campaign_key = 'supplementary-2026';

  IF v_set_count = 0 THEN
    INSERT INTO public.study_quiz_sets
      (title, description, course_code, level, semester, difficulty, time_limit_minutes,
       questions_count, published, visibility, source, delivery_mode, exam_campaign_key,
       access_tier, exam_question_count, diagnostic_question_count, diagnostic_time_limit_minutes)
    VALUES
      ('GNS 113 Exam Sprint Mock',
       'Private GNS 113 bank covering the official Use of Library module and modern information-literacy foundations.',
       'GNS 113', '100', 'first', 'hard', 40,
       0, false, 'private', 'exam_sprint', 'mock_exam', 'supplementary-2026',
       'plus_monthly', 40, 10, 10)
    RETURNING id INTO v_set_id;
  ELSIF v_set_count = 1 THEN
    SELECT id INTO v_set_id
    FROM public.study_quiz_sets
    WHERE upper(regexp_replace(coalesce(course_code, ''), '[^A-Za-z0-9]', '', 'g')) = 'GNS113'
      AND delivery_mode = 'mock_exam'
      AND exam_campaign_key = 'supplementary-2026'
    LIMIT 1;
  ELSE
    RAISE EXCEPTION 'More than one GNS 113 Exam Sprint bank exists. Keep one target bank before importing.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.study_quiz_questions
    WHERE coalesce(set_id, quiz_set_id) = v_set_id
  ) THEN
    RAISE EXCEPTION 'The GNS 113 target bank already contains questions. Import stopped to prevent duplicates.';
  END IF;

  FOR v_question IN
    SELECT value FROM jsonb_array_elements($gns113_questions$${payload}$gns113_questions$::jsonb)
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
WHERE upper(regexp_replace(coalesce(s.course_code, ''), '[^A-Za-z0-9]', '', 'g')) = 'GNS113'
  AND s.delivery_mode = 'mock_exam'
  AND s.exam_campaign_key = 'supplementary-2026'
GROUP BY s.id, s.title;
`;
}

function renderMarkdown() {
  const lines = [
    "# GNS 113 — 200-question Exam Sprint bank",
    "",
    "Primary source: supplied official GNS 113 Use of Library module. Modern information-literacy enrichment is clearly labelled.",
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
  const sourceKind = { supplied_material: 0, general_gns113: 0 };
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
  if (sourceKind.supplied_material !== 160 || sourceKind.general_gns113 !== 40) {
    errors.push(`Source balance is ${JSON.stringify(sourceKind)}, expected 160/40.`);
  }
  if (topicCounts.size !== 10 || [...topicCounts.values()].some((count) => count !== 20)) {
    errors.push(`Expected 10 topics with 20 questions each; got ${JSON.stringify(Object.fromEntries(topicCounts))}.`);
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
const sqlPath = resolve("deliverables/GNS113_import_exam_bank_200.sql");
const markdownPath = resolve("deliverables/GNS113_question_bank_200.md");
mkdirSync(dirname(sqlPath), { recursive: true });
writeFileSync(sqlPath, renderSql(rows), "utf8");
writeFileSync(markdownPath, renderMarkdown(), "utf8");
console.log(JSON.stringify({ ...summary, sqlPath, markdownPath }, null, 2));
