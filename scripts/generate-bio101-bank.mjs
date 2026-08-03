import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const bank = [];
const M = "supplied_bio111_material";
const G = "general_biology1";

function addSession(topic, session, rows) {
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
      sourceLabel: sourceKind === M ? `BIO 111 General Biology I module, Study Session ${session}` : `General Biology I enrichment: ${topic}`,
      cognitive: difficulty === "easy" ? "recall" : difficulty === "hard" ? "analysis" : "application",
      questionKind: difficulty === "easy" ? "concept" : "application",
    });
  }
}

// Study Session 1 (20)
addSession("Meaning, Scope and Scientific Method of Biology", 1, [
  ["From which Greek words is biology derived?", "Bios and logos", ["Bio and scientia", "Zoon and botan", "Cella and logos"], "Bios means life and logos means knowledge or study.", "easy"],
  ["What is biology?", "The scientific study of life", ["The study of rocks only", "The manufacture of laboratory equipment", "The study of numbers without organisms"], "Biology investigates living organisms and life processes.", "easy"],
  ["Which branch of biology studies animals?", "Zoology", ["Botany", "Mycology", "Cytology"], "Zoology is the study of animals.", "easy"],
  ["Which branch of biology studies plants?", "Botany", ["Entomology", "Pathology", "Malacology"], "Botany is the biological study of plants.", "easy"],
  ["Which branch studies microorganisms?", "Microbiology", ["Anatomy", "Ecology", "Embryology"], "Microbiology studies microscopic organisms and agents such as bacteria, fungi and viruses.", "easy"],
  ["Which branch of biology focuses on cells?", "Cytology", ["Histology", "Physiology", "Ichthyology"], "Cytology is the study of cells.", "easy"],
  ["What usually begins a biological investigation?", "A careful observation", ["A final conclusion", "The destruction of all samples", "A law chosen before evidence"], "Observations reveal patterns or events that can lead to scientific questions.", "medium"],
  ["What is a scientific hypothesis?", "A testable proposed explanation for an observation", ["A result that can never be questioned", "A list of equipment only", "A conclusion made without evidence"], "A useful hypothesis proposes an explanation that evidence can support or challenge.", "medium"],
  ["What is a prediction in the scientific method?", "A logical expected outcome derived from a hypothesis", ["An unrecorded observation", "A replacement for an experiment", "A scientific instrument"], "A prediction states what should occur if the hypothesis is valid under specified conditions.", "medium"],
  ["Why is an experiment performed?", "To test a prediction under controlled conditions", ["To guarantee the preferred answer", "To avoid collecting data", "To turn a theory into an opinion"], "Experiments manipulate or compare conditions to gather evidence about a prediction.", "medium"],
  ["Why must experimental observations be recorded?", "So evidence can be analysed, checked and communicated", ["So unwanted results can be hidden", "So no conclusion is required", "So variables change without notice"], "Documented data support transparent analysis and repeatability.", "medium"],
  ["What is a scientific conclusion based on?", "The evidence obtained when a hypothesis is tested", ["The researcher's personal preference", "The cost of the experiment alone", "A prediction with no observation"], "A conclusion interprets results and states how they bear on the tested explanation.", "medium"],
  ["Which item is described as a product of science?", "A scientific theory", ["An unsupported rumour", "A hidden observation", "An untestable guess"], "Theories, laws and inventions are products developed through scientific work.", "medium"],
  ["Seedlings near a window bend toward light. Which statement is a testable hypothesis?", "Directional light causes the seedlings to grow toward its source", ["Plants simply like windows", "The observation must be false", "Every seedling everywhere bends east"], "The proposed cause can be tested by changing the direction or availability of light.", "hard"],
  ["A researcher records only results supporting a preferred explanation. Which scientific ethic is violated?", "Truthfulness in observation and reporting", ["Use of biological terminology", "Specialization in zoology", "Formation of a prediction"], "Selective reporting misrepresents evidence and undermines scientific integrity.", "hard"],
  ["An experiment repeatedly contradicts a hypothesis. What is the scientifically appropriate response?", "Revise or reject the hypothesis in light of the evidence", ["Delete the conflicting data", "Declare the hypothesis a law", "Prevent other researchers from repeating it"], "Scientific explanations remain open to modification when reproducible evidence does not support them.", "hard"],
  ["What is an independent variable?", "The factor deliberately changed by the investigator", ["The measured response", "Every factor kept constant", "An unavoidable error"], "The independent variable is manipulated to examine its effect on a response.", "easy", G],
  ["What is the purpose of a control group?", "To provide a baseline for comparison with the treatment", ["To receive every experimental treatment", "To remove the need for replication", "To guarantee a significant result"], "A suitable control helps isolate the effect of the tested factor.", "medium", G],
  ["What does peer review contribute to science?", "Independent evaluation of methods, reasoning and reporting", ["Proof that a result can never change", "Permission to omit evidence", "Replacement of experimental replication"], "Peer review can identify weaknesses and improve reports, though it is not an absolute guarantee.", "medium", G],
  ["A study finds that two variables rise together. Why can it not immediately claim that one causes the other?", "Correlation may result from confounding factors or reverse causation", ["Correlated measurements can never be useful", "Causation requires identical values", "Only laboratory equipment can cause change"], "Establishing cause requires a design that rules out plausible alternative explanations.", "hard", G],
]);

// Study Session 2 (20)
addSession("Characteristics and Processes of Living Things", 2, [
  ["What is the basic structural unit of living organisms?", "Cell", ["Tissue fluid", "Atom", "Organ system"], "Cells are the fundamental organized units in which life processes occur.", "easy"],
  ["What is reproduction?", "The production of new individuals from pre-existing organisms", ["The removal of metabolic waste", "A response to light", "The breakdown of food only"], "Reproduction maintains biological lineages by producing offspring.", "easy"],
  ["Which type of cellular respiration requires oxygen?", "Aerobic respiration", ["Anaerobic respiration", "Fermentation only", "Photosynthesis"], "Aerobic respiration uses oxygen in the release of energy from nutrients.", "easy"],
  ["Which type of respiration can occur without oxygen?", "Anaerobic respiration", ["Aerobic respiration", "Transpiration", "Excretion"], "Anaerobic pathways release energy without oxygen as the final electron acceptor.", "easy"],
  ["What is nutrition?", "Obtaining and using materials needed for growth, repair and maintenance", ["Removing all water from cells", "Producing offspring only", "Detecting environmental change"], "Nutrition supplies organisms with matter and energy for life processes.", "easy"],
  ["What is excretion?", "Removal of metabolic waste products from an organism", ["Egestion of every undigested food particle only", "Uptake of nutrients", "Formation of gametes"], "Excretion eliminates products generated by metabolism that may become harmful.", "easy"],
  ["How does physiological respiration differ from cellular respiration?", "Physiological respiration exchanges gases; cellular respiration releases usable energy in cells", ["Both mean only inhaling air", "Cellular respiration occurs only outside organisms", "Physiological respiration produces DNA"], "Breathing and gas exchange supply gases, while intracellular pathways transfer energy to ATP.", "medium"],
  ["What is the immediate energy-carrying molecule emphasized in cellular work?", "ATP", ["DNA", "Cellulose", "Chitin"], "Adenosine triphosphate couples energy-releasing reactions to cellular activities.", "medium"],
  ["How does an autotroph obtain organic food?", "It builds organic molecules from inorganic sources using energy", ["It must eat another organism", "It absorbs only ready-made proteins", "It cannot acquire carbon"], "Autotrophs use light or chemical energy to synthesize organic compounds.", "medium"],
  ["Which statement describes heterotrophic nutrition?", "Obtaining organic nutrients by consuming or absorbing material from other organisms", ["Making all food from carbon dioxide alone", "Using no source of energy", "Producing glucose without carbon"], "Heterotrophs depend directly or indirectly on organic matter made by other organisms.", "medium"],
  ["Which substances are reactants in oxygenic photosynthesis?", "Carbon dioxide and water", ["Glucose and oxygen", "ATP and DNA", "Protein and nitrogen gas only"], "Photosynthesis uses carbon dioxide and water to form carbohydrate, releasing oxygen.", "medium"],
  ["What is homeostasis?", "Maintenance of relatively stable internal conditions", ["Permanent absence of environmental change", "Movement from one location to another", "Production of genetically identical cells"], "Homeostatic regulation keeps variables within ranges compatible with life.", "medium"],
  ["How does development differ from growth?", "Development involves qualitative changes, while growth includes increase in size or mass", ["Development occurs only in non-living things", "Growth never involves cell division", "They are unrelated to organisms"], "Growth is quantitative increase; development includes differentiation and maturation.", "medium"],
  ["During strenuous exercise, muscle demand for ATP rises faster than oxygen delivery. Which process may temporarily increase?", "Anaerobic energy production", ["Photosynthesis", "DNA replication in every muscle cell", "Excretion of chromosomes"], "Cells can supplement aerobic respiration with anaerobic pathways when oxygen supply is limiting.", "hard"],
  ["A green plant is kept in darkness for several days. Which nutritional process is most directly reduced?", "Photoautotrophic production of carbohydrate", ["Absorption of every mineral ion", "Cellular respiration", "Excretion of metabolic waste"], "Without light energy, photosynthetic carbon fixation cannot proceed normally.", "hard"],
  ["Body temperature rises and sweating begins. What feature of life does this best demonstrate?", "Homeostatic response to internal change", ["Asexual reproduction", "Classification", "Heredity"], "Sweating helps counter a temperature increase and restore a regulated internal range.", "hard"],
  ["What is an enzyme?", "A biological catalyst that speeds a reaction without being consumed", ["A chromosome carrying every gene", "A lipid bilayer", "A waste product of all cells"], "Enzymes lower activation barriers and enable controlled metabolic reactions.", "easy", G],
  ["What is diffusion?", "Net movement of particles from higher to lower concentration", ["Movement that always requires ATP", "Replication of DNA", "Formation of a cell wall"], "Random molecular motion produces net movement down a concentration gradient.", "medium", G],
  ["What is osmosis?", "Net movement of water across a selectively permeable membrane toward lower water potential", ["Movement of proteins through any solid wall", "Active transport of oxygen only", "Division of a cell nucleus"], "Osmosis describes passive water movement across a membrane driven by water-potential differences.", "medium", G],
  ["An enzyme works at 25°C but loses activity after heating to 90°C. What is the best explanation?", "High temperature altered the protein's functional shape", ["The enzyme became a chromosome", "Heat converted the substrate into DNA", "All reactions stop above room temperature"], "Excessive heat can disrupt interactions maintaining enzyme structure and denature its active site.", "hard", G],
]);

// Study Session 3 (20)
addSession("Classification and Diversity of Living Things", 3, [
  ["Why are organisms classified?", "To organize biological diversity and show useful relationships", ["To remove scientific names", "To make every organism identical", "To prevent comparison"], "Classification provides a structured way to identify, study and relate organisms.", "easy"],
  ["In the five-kingdom framework used by the module, which kingdom contains prokaryotes?", "Prokaryotae", ["Animalia", "Plantae", "Fungi"], "The module groups bacteria and archaea under Prokaryotae in its historical five-kingdom treatment.", "easy"],
  ["What is a coccus bacterium?", "A roughly spherical bacterium", ["A spiral bacterium", "A rod-shaped bacterium", "A comma-shaped bacterium"], "Cocci are bacteria described by their spherical form.", "easy"],
  ["Which kingdom in the module contains protozoa and many algae?", "Protista", ["Animalia", "Fungi", "Prokaryotae"], "Protista includes diverse eukaryotes not placed with animals, plants or fungi in the module's framework.", "easy"],
  ["What material is a major component of fungal cell walls?", "Chitin", ["Glycogen", "Peptidoglycan", "Starch"], "Fungal walls commonly contain chitin, whereas plant walls are rich in cellulose.", "easy"],
  ["Which organelle enables plant cells to perform photosynthesis?", "Chloroplast", ["Lysosome", "Centriole", "Nucleolus"], "Chloroplasts contain pigments and membranes that capture light energy for photosynthesis.", "easy"],
  ["What feature separates prokaryotic cells from eukaryotic cells most directly?", "Prokaryotes lack a membrane-bound nucleus", ["Prokaryotes contain no DNA", "Eukaryotes contain no ribosomes", "Only prokaryotes have plasma membranes"], "Prokaryotic DNA occupies a nucleoid rather than a nucleus enclosed by a membrane.", "medium"],
  ["How do fungi commonly obtain nutrients?", "They secrete enzymes and absorb externally digested products", ["They ingest food through a mouth", "They photosynthesize with chlorophyll", "They manufacture nutrients from no raw materials"], "Fungal hyphae digest organic material outside the body and absorb soluble molecules.", "medium"],
  ["In what form do fungi commonly store carbohydrate?", "Glycogen", ["Cellulose", "Peptidoglycan", "Chlorophyll"], "Fungi store carbohydrate mainly as glycogen rather than plant starch.", "medium"],
  ["Which feature is characteristic of the plant kingdom?", "Multicellular eukaryotic cells with cellulose walls and photosynthetic adaptation", ["Cells lacking DNA", "Nutrition only by external digestion", "Absence of cell membranes"], "Plants are eukaryotic organisms whose cells generally have cellulose walls and chloroplasts.", "medium"],
  ["Which statement best describes animals?", "They are multicellular eukaryotic heterotrophs without cell walls", ["They are prokaryotes with peptidoglycan", "They all photosynthesize", "They absorb nutrients through fungal hyphae"], "Animal cells lack rigid cell walls and animals obtain organic nutrients heterotrophically.", "medium"],
  ["Which pairing of bacterial shape and name is correct?", "Bacillus — rod-shaped", ["Coccus — spiral", "Spirillum — spherical", "Vibrio — cubical"], "Bacilli are rod-shaped, cocci are spherical, spirilla are spiral and vibrios are curved or comma-shaped.", "medium"],
  ["What is the relationship between hyphae and a mycelium?", "A mycelium is a network or mass of hyphae", ["A hypha is a group of animal organs", "A mycelium is a bacterial chromosome", "They are pigments in chloroplasts"], "Filamentous fungal bodies are built from microscopic threads called hyphae.", "medium"],
  ["An organism is unicellular, has ribosomes and circular DNA but no membrane-bound nucleus. How should it be classified at the cell-type level?", "Prokaryotic", ["Multicellular animal", "Fungal tissue", "Plant organ"], "The absence of a membrane-bound nucleus with circular cellular DNA indicates a prokaryotic cell.", "hard"],
  ["An organism has chitinous walls, forms hyphae and absorbs digested nutrients. Which kingdom best fits?", "Fungi", ["Plantae", "Animalia", "Prokaryotae"], "Chitin walls, hyphal growth and absorptive nutrition are diagnostic fungal characteristics.", "hard"],
  ["Why should the module's five-kingdom system be treated as a model rather than an unchangeable fact?", "Classification systems change when new evolutionary evidence becomes available", ["Organisms have no evolutionary history", "All taxonomists must use five kingdoms", "Molecular data cannot inform relationships"], "Modern classifications often use domains and revised kingdoms to reflect genetic and phylogenetic evidence.", "hard"],
  ["What is binomial nomenclature?", "Naming a species with a genus name and a specific epithet", ["Giving every organism one common nickname", "Classifying only by colour", "Naming an organism after its habitat alone"], "The two-part scientific name supports consistent identification across languages and regions.", "easy", G],
  ["Which three domains are widely recognized in modern classification?", "Bacteria, Archaea and Eukarya", ["Plants, animals and viruses", "Fungi, protists and minerals", "Cocci, bacilli and spirilla"], "The three-domain framework reflects major evolutionary divisions revealed by molecular evidence.", "medium", G],
  ["Why are homologous structures useful in classification?", "They can indicate shared evolutionary ancestry", ["They always perform identical functions", "They occur only in one species", "They cannot be compared genetically"], "Homologous features derive from corresponding ancestral structures even when functions differ.", "medium", G],
  ["DNA evidence places two look-alike organisms in distant evolutionary groups. What is the best taxonomic response?", "Reassess their classification using the combined molecular and morphological evidence", ["Ignore DNA because appearance is always decisive", "Place every similar-looking organism in one species", "Abandon classification entirely"], "Convergent appearance can mislead, so robust classification integrates multiple independent evidence sources.", "hard", G],
]);

// Study Session 4 (20)
addSession("Cell Discovery, Cell Theory and Common Features", 4, [
  ["What is the fundamental unit of life?", "Cell", ["Organ", "Tissue", "Chromosome"], "The cell is the smallest organized unit capable of carrying out the activities of life.", "easy"],
  ["Who first described cells in cork in 1665?", "Robert Hooke", ["Gregor Mendel", "Theodor Schwann", "Rudolf Virchow"], "Hooke used an early microscope to observe box-like compartments in thin cork sections.", "easy"],
  ["What did Robert Hooke actually observe in cork?", "The walls of dead plant cells", ["Living bacterial nuclei", "Animal chromosomes dividing", "Chloroplasts producing oxygen"], "The empty compartments in cork were remnants of dead cells.", "easy"],
  ["Who called microscopic single-celled organisms 'animalcules'?", "Antonie van Leeuwenhoek", ["Robert Brown", "Mathias Schleiden", "August Weismann"], "Leeuwenhoek observed living microorganisms in samples such as pond water.", "easy"],
  ["Which scientists proposed that plants and animals are composed of cells?", "Schleiden and Schwann", ["Mendel and Darwin", "Hooke and Virchow only", "Watson and Crick"], "Schleiden's plant observations and Schwann's animal studies helped establish classical cell theory.", "easy"],
  ["What principle is associated with Rudolf Virchow?", "New cells arise from pre-existing cells", ["Cells arise spontaneously from minerals", "Only plants contain cells", "Genes are made of protein only"], "Virchow extended cell theory by emphasizing continuity through cell division.", "easy"],
  ["What does the Latin word cella mean?", "Small room", ["Living water", "Protein factory", "Hereditary code"], "The name cell was inspired by small room-like compartments seen in cork.", "medium"],
  ["Which set contains structures found in every cellular organism?", "Plasma membrane, cytoplasm, DNA and ribosomes", ["Nucleus, chloroplast, cell wall and lysosome", "Mitochondrion, Golgi body, centriole and vacuole", "Chloroplast, flagellum, nucleus and capsule"], "All cells have a boundary membrane, cytoplasm, hereditary material and protein-synthesizing ribosomes.", "medium"],
  ["Which statement is part of cell theory?", "All organisms are composed of one or more cells", ["All cells contain chloroplasts", "Cells form only by spontaneous generation", "Every cell has a rigid wall"], "Cell theory recognizes cells as the structural and functional basis of organisms.", "medium"],
  ["Why are cells called functional units of life?", "Biochemical processes necessary for life occur within cells", ["Only cells can be seen without instruments", "Every cell is a complete multicellular organism", "Cells contain no chemical reactions"], "Cellular organization supports metabolism, regulation, growth and reproduction.", "medium"],
  ["Why does every cell require a plasma membrane?", "To maintain a distinct internal environment and regulate exchange", ["To create all genetic variation", "To replace ribosomes", "To prevent any substance from crossing"], "The membrane separates cellular contents while permitting controlled movement and communication.", "medium"],
  ["Why is DNA essential to a cell?", "It stores hereditary instructions that specify cellular structure and activity", ["It supplies immediate mechanical movement", "It forms the lipid bilayer", "It digests all nutrients"], "DNA contains encoded information used in inheritance and cellular control.", "medium"],
  ["Why must cells convert energy into forms such as ATP?", "Cellular processes require a usable energy carrier", ["ATP is the only genetic material", "Energy cannot exist in nutrients", "ATP forms every cell wall"], "ATP transfers energy to reactions and work performed by the cell.", "medium"],
  ["A drug prevents ribosomes from functioning. Which process will fail most directly?", "Protein synthesis", ["Formation of the phospholipid bilayer only", "Storage of DNA sequence", "Diffusion of water"], "Ribosomes translate messenger RNA into polypeptide chains.", "hard"],
  ["A cell retains its membrane and cytoplasm but loses its DNA. What long-term ability is most directly lost?", "Control and faithful transmission of hereditary instructions", ["Immediate passive movement of water", "Existence of all lipids", "The physical boundary of the cell"], "Without genetic information, the cell cannot properly direct ongoing synthesis or reproduce its program.", "hard"],
  ["Why are viruses not included as cells in classical cell theory?", "They lack independent cellular organization and depend on host cells for replication", ["They are larger than every cell", "They contain every organelle", "They reproduce by ordinary mitosis"], "Viruses are acellular entities and cannot carry out full metabolism or reproduction independently.", "hard"],
  ["What does microscope resolution describe?", "The ability to distinguish two close points as separate", ["The colour of the microscope", "The total mass of a specimen", "The number of cells produced"], "Resolution determines the fine detail that can be distinguished in an image.", "easy", G],
  ["Why are most cells microscopically small?", "A high surface-area-to-volume ratio supports efficient exchange", ["Small cells contain no DNA", "Large cells cannot have membranes", "Microscopes cause cells to shrink"], "As a cell grows, volume rises faster than surface area, making transport across the surface less efficient.", "medium", G],
  ["What is a stem cell?", "An unspecialized cell capable of self-renewal and differentiation", ["A dead cork compartment", "A virus without genetic material", "A mature cell that can never divide"], "Stem cells can produce additional stem cells and descendants with specialized functions.", "medium", G],
  ["Researchers observe a structure in all tested cells and suspect it is universally essential. What evidence would most strongly test the claim?", "Examine diverse lineages and determine whether loss of the structure prevents cellular function", ["Study one cell type only", "Rely on the structure's colour", "Assume repeated wording proves universality"], "A universal claim requires broad sampling and functional evidence, not a single observation.", "hard", G],
]);

// Study Session 5 (20)
addSession("Prokaryotic and Eukaryotic Cell Types", 5, [
  ["Which two broad cell types are recognized in the module?", "Prokaryotic and eukaryotic", ["Plant and mineral", "Aerobic and inorganic", "Tissue and organ"], "Cells are broadly distinguished by whether they possess a membrane-bound nucleus and compartments.", "easy"],
  ["Where is the main chromosome located in a prokaryotic cell?", "Nucleoid region", ["Nucleolus", "Golgi apparatus", "Mitochondrial matrix"], "Prokaryotic DNA occupies a nucleoid that is not enclosed by a nuclear membrane.", "easy"],
  ["Which organisms are prokaryotic?", "Bacteria and archaea", ["Animals and plants", "Fungi and animals", "Plants and protists only"], "The domains Bacteria and Archaea consist of prokaryotic cells.", "easy"],
  ["Which structure is absent from a prokaryotic cell?", "Membrane-bound nucleus", ["Ribosome", "Plasma membrane", "DNA"], "Prokaryotes contain DNA and ribosomes but lack a true nucleus.", "easy"],
  ["What major polymer strengthens most bacterial cell walls?", "Peptidoglycan", ["Cellulose", "Chitin", "Glycogen"], "Peptidoglycan forms a strong mesh that helps maintain bacterial shape and resist osmotic pressure.", "easy"],
  ["How do many bacteria reproduce?", "Binary fission", ["Meiosis", "Budding of a multicellular embryo", "Fusion of gametes only"], "Binary fission duplicates the chromosome and divides one bacterial cell into two.", "easy"],
  ["What is a plasmid?", "A small DNA molecule that replicates independently of the main bacterial chromosome", ["A membrane-bound digestive organelle", "A protein in the cell wall", "A eukaryotic spindle fibre"], "Plasmids can carry accessory genes and move between some bacterial cells.", "medium"],
  ["What is a common function of bacterial pili?", "Attachment to surfaces or other cells", ["Production of ATP in cristae", "Storage of chromosomes in a nucleus", "Digestion inside lysosomes"], "Pili are short protein appendages that aid adhesion; specialized pili participate in conjugation.", "medium"],
  ["What is the role of a sex pilus?", "Facilitating DNA transfer during bacterial conjugation", ["Carrying out photosynthesis", "Producing peptidoglycan", "Separating chromatids in meiosis"], "A conjugative pilus helps establish contact for transfer of genetic material.", "medium"],
  ["How does a bacterial flagellum commonly move the cell?", "By rotating like a propeller", ["By forming a mitotic spindle", "By beating with a eukaryotic 9+2 motion", "By producing pseudopodia"], "Rotation of the bacterial flagellar filament drives movement through fluid.", "medium"],
  ["What is a defining feature of eukaryotic cells?", "Membrane-bound organelles and a true nucleus", ["Absence of ribosomes", "DNA located only in a nucleoid", "Cell walls made only of peptidoglycan"], "Eukaryotic compartmentalization separates many cellular processes into organelles.", "medium"],
  ["Why is compartmentalization useful in eukaryotic cells?", "It separates incompatible reactions and creates specialized environments", ["It prevents all molecules from moving", "It removes the need for enzymes", "It eliminates energy conversion"], "Membrane-bound compartments allow reactions to be regulated under distinct conditions.", "medium"],
  ["Which set lists the three major cytoskeletal fibre systems?", "Microfilaments, microtubules and intermediate filaments", ["Flagella, pili and capsules", "Cellulose, chitin and peptidoglycan", "DNA, RNA and ATP"], "Eukaryotic cytoskeletons use actin filaments, microtubules and intermediate filaments.", "medium"],
  ["An antibiotic blocks peptidoglycan synthesis. Which cells are most directly targeted?", "Bacterial cells", ["Human red blood cells", "Plant chloroplasts only", "Fungal cells with chitin walls"], "Peptidoglycan is characteristic of bacterial walls and is absent from human cells.", "hard"],
  ["A mutation disrupts microtubule assembly in a eukaryotic cell. Which process is likely affected?", "Chromosome movement during cell division", ["Peptidoglycan synthesis", "Binary fission of all bacteria", "Formation of bacterial pili"], "Microtubules form the spindle apparatus that separates chromosomes.", "hard"],
  ["A resistance gene spreads rapidly between bacterial cells without cell division. Which structure is most likely involved?", "A transferable plasmid and conjugation machinery", ["A lysosome and Golgi body", "A chloroplast and vacuole", "A mitotic spindle and centriole"], "Conjugative plasmids can transfer accessory genes horizontally between bacteria.", "hard"],
  ["Which organelles provide strong evidence for the endosymbiotic origin of eukaryotic cells?", "Mitochondria and chloroplasts", ["Lysosomes and Golgi bodies", "Nucleoli and vesicles", "Cell walls and capsules"], "Mitochondria and chloroplasts retain bacterial-like DNA, ribosomes and division features.", "easy", G],
  ["What is endocytosis?", "Uptake of material by inward folding and vesicle formation at the plasma membrane", ["Passive movement through an open cell wall", "Replication of a bacterial chromosome", "Release of proteins by exocytosis"], "Endocytosis encloses extracellular material in a membrane-bound vesicle.", "medium", G],
  ["Why do prokaryotic cells generally not require membrane-bound organelles to the same extent as large eukaryotic cells?", "Their small size allows short diffusion distances and close coupling of processes", ["They perform no metabolism", "They contain no enzymes", "Their DNA controls no activity"], "Small dimensions help molecules reach cellular sites efficiently despite limited internal compartments.", "medium", G],
  ["A gene tree disagrees with a bacterial species tree because a plasmid moved between species. What process explains the mismatch?", "Horizontal gene transfer", ["Independent assortment in meiosis", "Mitosis in animal tissue", "Incomplete dominance"], "Genes transferred across lineages can have histories different from the organisms' core ancestry.", "hard", G],
]);

// Study Session 6 (20)
addSession("Plasma Membrane and Nucleus", 6, [
  ["What is the basic structural arrangement of the plasma membrane?", "Phospholipid bilayer", ["Peptidoglycan monolayer", "Cellulose triple helix", "Protein crystal only"], "Two layers of phospholipids form the flexible boundary of the cell.", "easy"],
  ["Which part of a phospholipid faces the watery environment?", "Hydrophilic head", ["Hydrophobic tail", "Fatty acid interior only", "Cholesterol ring exclusively"], "Polar heads interact with water on both sides of the membrane.", "easy"],
  ["Where are the hydrophobic phospholipid tails located?", "Toward the interior of the bilayer", ["Exposed to water on both surfaces", "Inside the nucleus", "Attached only to chromosomes"], "Nonpolar tails associate away from water in the membrane core.", "easy"],
  ["What does selective permeability mean?", "The membrane regulates which substances cross", ["Nothing can cross the membrane", "Every substance crosses equally", "Only water can ever cross"], "Selective permeability enables controlled exchange between the cell and its environment.", "easy"],
  ["Which organelle houses most of a eukaryotic cell's chromosomes?", "Nucleus", ["Lysosome", "Ribosome", "Golgi apparatus"], "The nucleus encloses chromosomal DNA and participates in cellular control.", "easy"],
  ["What is the main function of the nucleolus?", "Ribosomal RNA production and ribosome-subunit assembly", ["Lipid digestion", "ATP generation", "Photosynthesis"], "The nucleolus produces rRNA and assembles it with imported proteins into ribosomal subunits.", "easy"],
  ["How does cholesterol influence an animal-cell membrane?", "It helps regulate membrane fluidity and stability", ["It stores genetic information", "It forms ribosomes", "It builds peptidoglycan"], "Cholesterol moderates phospholipid movement across temperature conditions.", "medium"],
  ["What do membrane receptor proteins do?", "Bind signals and initiate cellular responses", ["Translate mRNA into protein", "Replicate chromosomes", "Make every lipid"], "Receptors allow cells to detect hormones, neurotransmitters and other signals.", "medium"],
  ["What is the function of a membrane transport protein?", "Helping selected ions or molecules cross the membrane", ["Producing spindle fibres", "Storing DNA", "Digesting damaged organelles"], "Channels and carriers provide regulated routes across the lipid bilayer.", "medium"],
  ["What surrounds the eukaryotic nucleus?", "A double-membrane nuclear envelope", ["A peptidoglycan wall", "A single protein fibre", "A thylakoid stack"], "Inner and outer nuclear membranes enclose the nucleoplasm.", "medium"],
  ["What is the purpose of nuclear pores?", "Controlled transport between nucleus and cytoplasm", ["ATP production from oxygen", "External digestion of food", "Formation of cell walls"], "Pore complexes regulate movement of RNAs, proteins and other molecules across the nuclear envelope.", "medium"],
  ["What is chromatin?", "DNA associated with proteins in the nucleus", ["A membrane lipid", "A lysosomal enzyme", "A bacterial pilus"], "Chromatin packages and regulates eukaryotic genetic material.", "medium"],
  ["How does cytosol differ from cytoplasm?", "Cytosol is the fluid component; cytoplasm includes cytosol and cellular structures outside the nucleus", ["Cytosol is inside chromosomes only", "Cytoplasm is only the nuclear fluid", "They both mean cell wall"], "Cytoplasm encompasses the extranuclear contents, whereas cytosol refers to its aqueous phase.", "medium"],
  ["A cell cannot insert functional receptors into its plasma membrane. Which ability is most directly impaired?", "Detection of specific extracellular signals", ["Replication of bacterial plasmids", "Formation of peptidoglycan", "Crossing over in meiosis"], "Without receptors, the cell may fail to recognize and respond to signalling molecules.", "hard"],
  ["A toxin blocks export of messenger RNA through nuclear pores. What process will decline in the cytoplasm?", "Protein synthesis from nuclear gene transcripts", ["DNA storage in chromosomes", "Formation of phospholipid heads", "Osmosis through the cell wall only"], "Most mRNA must leave the nucleus to be translated by cytoplasmic ribosomes.", "hard"],
  ["A mutation weakens nuclear lamins. Which event may become abnormal?", "Nuclear-envelope organization and reassembly during cell division", ["Bacterial flagellar rotation", "Chlorophyll absorption", "Peptidoglycan cross-linking"], "Lamins provide nuclear structural support and participate in envelope breakdown and reformation.", "hard"],
  ["What is simple diffusion across a membrane?", "Passive movement directly through the bilayer down a concentration gradient", ["Movement against a gradient using ATP", "Vesicle-mediated bulk transport", "DNA replication"], "Small suitable molecules can cross the lipid bilayer without a transport protein or energy input.", "easy", G],
  ["How does facilitated diffusion differ from simple diffusion?", "It uses a membrane protein while still moving down a gradient", ["It always consumes ATP", "It moves only water", "It occurs only in nuclei"], "Facilitated diffusion is passive but depends on selective channels or carriers.", "medium", G],
  ["What defines active transport?", "Movement against an electrochemical gradient using energy", ["Random movement down a gradient", "Transport that never uses proteins", "Movement of chromosomes during mitosis"], "Active transport couples an energy source to uphill movement of solutes.", "medium", G],
  ["An animal cell is placed in a strongly hypotonic solution and swells. What caused the swelling?", "Net osmosis of water into the cell", ["Active export of all water", "DNA entering through nuclear pores", "Peptidoglycan absorbing ATP"], "The external solution has higher water potential, so water enters across the selectively permeable membrane.", "hard", G],
]);

// Study Session 7 (20)
addSession("Endoplasmic Reticulum and Golgi Apparatus", 7, [
  ["What gives rough endoplasmic reticulum its rough appearance?", "Ribosomes attached to its surface", ["Stacks of chlorophyll", "Deposits of peptidoglycan", "Chromosomes in its lumen"], "Ribosomes bound to the cytoplasmic face produce the rough appearance.", "easy"],
  ["Which endoplasmic-reticulum region is mainly tubular and lacks attached ribosomes?", "Smooth endoplasmic reticulum", ["Rough endoplasmic reticulum", "Nucleolus", "Golgi cisterna"], "Smooth ER is an interconnected tubular membrane system without surface-bound ribosomes.", "easy"],
  ["Which proteins are commonly synthesized on rough-ER ribosomes?", "Secreted and membrane proteins", ["Only cytosolic glycolytic enzymes", "DNA polymer molecules", "Peptidoglycan chains"], "Proteins entering the secretory pathway are translated on ribosomes associated with rough ER.", "easy"],
  ["Which process is a major function of smooth ER?", "Lipid and steroid metabolism", ["Chromosome segregation", "Ribosomal RNA transcription", "Photosynthesis"], "Smooth ER synthesizes and metabolizes phospholipids, fatty acids and steroids.", "easy"],
  ["What is the principal role of the Golgi apparatus?", "Modifying, sorting and packaging proteins and lipids", ["Replicating nuclear DNA", "Producing ATP from oxygen", "Digesting bacteria directly"], "Golgi cisternae process cargo and direct it toward appropriate cellular destinations.", "easy"],
  ["How is cargo commonly transported from ER to Golgi?", "In transport vesicles", ["Through bacterial pili", "Along a chromosome", "Inside a lysosomal enzyme"], "Membrane-bound vesicles bud from ER regions and fuse with Golgi compartments.", "easy"],
  ["What is the endoplasmic reticulum structurally?", "A network of membrane tubules and flattened sacs", ["A single protein crystal", "A stack of chromosomes", "An external cell wall"], "The ER forms an extensive internal membrane network continuous in many regions.", "medium"],
  ["Why are antibody-producing cells rich in rough ER?", "They synthesize and secrete large quantities of protein", ["They carry out photosynthesis", "They produce peptidoglycan", "They lack ribosomes"], "Antibodies are secreted proteins and therefore pass through the rough-ER pathway.", "medium"],
  ["Why is smooth ER abundant in many liver cells?", "It contains enzymes involved in detoxification", ["It performs mitotic chromosome alignment", "It makes bacterial cell walls", "It stores every gene"], "Smooth-ER enzymes modify drugs and toxic compounds to aid their elimination.", "medium"],
  ["What does the Golgi commonly add to some proteins?", "Carbohydrate groups", ["Whole chromosomes", "Peptidoglycan layers", "Bacterial flagella"], "Golgi processing can form glycoproteins by modifying attached carbohydrate chains.", "medium"],
  ["What is exocytosis?", "Fusion of a vesicle with the plasma membrane to release cargo", ["Uptake of a bacterium into a vesicle", "Passive movement through a channel", "Duplication of DNA"], "Secretory vesicles export their contents when their membrane joins the cell surface.", "medium"],
  ["How do rough and smooth ER cooperate?", "Proteins and membranes made in rough ER can pass through transitional ER regions for transport", ["They operate in different organisms only", "Smooth ER translates mRNA", "Rough ER stores chromosomes"], "The two ER domains are interconnected parts of a coordinated endomembrane system.", "medium"],
  ["Which sequence correctly traces a secreted protein?", "Rough ER, transport vesicle, Golgi, secretory vesicle, plasma membrane", ["Nucleus, lysosome, chromosome, cell wall", "Smooth ER, nucleolus, mitochondrion, ribosome", "Vacuole, DNA, centriole, Golgi"], "Secreted proteins enter rough ER, undergo Golgi processing and leave the cell by exocytosis.", "medium"],
  ["A mutation prevents ER-derived vesicles from fusing with the Golgi. What accumulates most directly?", "New secretory cargo in the ER or transport vesicles", ["Chromosomes at the cell surface", "ATP inside cell walls", "Peptidoglycan in the nucleus"], "Blocking this transport step prevents secretory proteins from reaching the Golgi.", "hard"],
  ["A toxin damages smooth ER enzymes in liver cells. Which ability is most directly reduced?", "Detoxification and lipid metabolism", ["Translation on ribosomes only", "Chromosome replication", "Formation of spindle fibres"], "Smooth ER carries enzymes important for lipid processing and detoxification.", "hard"],
  ["A Golgi enzyme that adds carbohydrates to proteins is missing. Which product is most directly altered?", "Glycoproteins destined for membranes or secretion", ["Nuclear DNA", "Peptidoglycan", "Free cytosolic ATP"], "Golgi glycosylation contributes to the final structure and targeting of many proteins.", "hard"],
  ["What is a signal peptide?", "An amino-acid sequence that can direct a new protein into a cellular pathway", ["A phospholipid tail", "A chromosome centromere", "A bacterial cell wall"], "Targeting sequences help route proteins to locations such as the ER, nucleus or mitochondrion.", "easy", G],
  ["What is the unfolded-protein response?", "A cellular response to excessive misfolded proteins in the ER", ["A mechanism for bacterial conjugation", "A phase of meiosis", "A method of ATP storage"], "ER stress sensors reduce the folding burden and increase quality-control capacity.", "medium", G],
  ["Why do transport vesicles require specific recognition proteins?", "They must fuse with the correct target membrane", ["Every vesicle carries identical cargo to random sites", "Recognition creates DNA", "Vesicles contain no membrane"], "Molecular identity and docking systems maintain directional, accurate cargo traffic.", "medium", G],
  ["A pulse of labelled amino acids appears first in rough ER, then Golgi, then outside a cell. What does the sequence demonstrate?", "Movement of a secreted protein through the endomembrane pathway", ["Replication of mitochondrial DNA", "Passive diffusion of chromosomes", "Formation of a bacterial wall"], "Time-resolved labelling can trace newly synthesized secretory cargo through successive compartments.", "hard", G],
]);

// Study Session 8 (20)
addSession("Lysosomes and Ribosomes", 8, [
  ["What is the primary function of a lysosome?", "Intracellular digestion and recycling", ["Photosynthesis", "Chromosome segregation", "Protein transcription"], "Lysosomal enzymes break down macromolecules, foreign material and worn cellular components.", "easy"],
  ["Which macromolecules can lysosomal enzymes degrade?", "Proteins, lipids, carbohydrates and nucleic acids", ["Only water", "Only oxygen", "Only mineral salts"], "Lysosomes contain many hydrolytic enzymes with broad digestive roles.", "easy"],
  ["How does lysosomal pH compare with cytoplasmic pH?", "It is more acidic", ["It is always identical", "It is strongly alkaline", "It contains no water"], "The lysosomal lumen is maintained near pH 5, favouring its digestive enzymes.", "easy"],
  ["From which organelle are many lysosomal enzymes delivered?", "Golgi apparatus", ["Chloroplast", "Centriole", "Cell wall"], "Lysosomal enzymes pass through the ER-Golgi secretory pathway and are sorted to lysosomes.", "easy"],
  ["What are ribosomes made of?", "Ribosomal RNA and proteins", ["DNA and phospholipids only", "Cellulose and chitin", "ATP and peptidoglycan"], "Each ribosomal subunit contains rRNA molecules and ribosomal proteins.", "easy"],
  ["What is the main function of a ribosome?", "Protein synthesis", ["Lipid digestion", "Photosynthesis", "DNA storage"], "Ribosomes translate messenger-RNA sequences into ordered amino-acid chains.", "easy"],
  ["What is a secondary lysosome?", "A digestive compartment formed when a lysosome fuses with a cargo-containing vesicle", ["A second nucleus", "A stack of thylakoids", "A bacterial chromosome"], "Fusion brings hydrolytic enzymes into contact with ingested material.", "medium"],
  ["Which plant organelle performs many functions analogous to lysosomal digestion?", "Vacuole", ["Cell wall", "Chloroplast stroma", "Nucleolus"], "Plant vacuoles contain hydrolytic enzymes and participate in breakdown and recycling.", "medium"],
  ["Where can ribosomes occur in a eukaryotic cell?", "Free in cytosol or bound to membranes such as rough ER", ["Only inside lysosomes", "Only in the cell wall", "Only within chromosomes"], "Ribosome location relates to the destination of the protein being synthesized.", "medium"],
  ["What carries genetic instructions from DNA to a ribosome?", "Messenger RNA", ["Cholesterol", "Glycogen", "Peptidoglycan"], "mRNA is transcribed from DNA and supplies the codon sequence used in translation.", "medium"],
  ["What does translation produce?", "A polypeptide with a specific amino-acid sequence", ["A copy of DNA", "A phospholipid bilayer", "A chromosome pair"], "The ribosome decodes mRNA and joins amino acids into a protein chain.", "medium"],
  ["What is a polyribosome?", "Several ribosomes translating the same mRNA molecule", ["A lysosome with many enzymes", "A chromosome with many centromeres", "A vacuole containing pigments"], "Multiple ribosomes can translate one transcript simultaneously to increase protein output.", "medium"],
  ["Why are lysosomal enzymes usually separated from cytoplasm by a membrane?", "Compartmentalization limits uncontrolled digestion of cellular components", ["The enzymes cannot function in water", "Membranes create DNA", "Cytoplasm contains no proteins"], "Physical separation and pH control protect the cell while concentrating digestive activity.", "medium"],
  ["A sorting defect sends lysosomal enzymes outside the cell. What happens inside lysosomes?", "Undigested material may accumulate", ["Protein synthesis accelerates automatically", "Chromosomes double", "Photosynthesis begins"], "Lysosomes deprived of their enzymes cannot efficiently break down incoming cargo.", "hard"],
  ["A drug neutralizes lysosomal acidity. Why does digestion slow?", "Many lysosomal enzymes require an acidic environment", ["Ribosomes require low pH", "DNA becomes peptidoglycan", "The plasma membrane disappears"], "Changing lumen pH reduces the catalytic activity of acid hydrolases.", "hard"],
  ["An antibiotic selectively blocks bacterial ribosomes. What immediate effect occurs?", "Bacterial protein synthesis stops or declines", ["Bacterial DNA instantly vanishes", "All host lysosomes rupture", "Bacteria begin meiosis"], "Ribosome inhibition prevents translation of proteins needed for bacterial survival and growth.", "hard"],
  ["What is autophagy?", "Delivery of cellular material to lysosomes for degradation and recycling", ["Replication of an entire organism", "Movement of water through a membrane", "Formation of gametes"], "Autophagy removes damaged components and recovers useful building blocks.", "easy", G],
  ["How does the proteasome differ from a lysosome?", "It degrades selected tagged proteins without enclosing them in a lysosomal lumen", ["It performs photosynthesis", "It is a bacterial cell wall", "It stores chromosomes"], "Proteasomes recognize proteins marked for destruction, often by ubiquitin.", "medium", G],
  ["Why is ribosomal RNA considered functionally important rather than merely structural?", "It helps catalyse peptide-bond formation", ["It stores all hereditary information", "It forms phospholipid tails", "It pumps protons across lysosomes"], "The ribosome's catalytic centre is largely formed by rRNA.", "medium", G],
  ["A cytosolic enzyme is accidentally given an ER-targeting signal. What is the likely outcome?", "It enters the secretory pathway instead of remaining free in cytosol", ["It becomes a chromosome", "It forms peptidoglycan", "It is translated only in the nucleus"], "Targeting information influences where translation continues and where the completed protein is delivered.", "hard", G],
]);

// Study Session 9 (20)
addSession("Mitochondria and Vacuoles", 9, [
  ["How many boundary membranes surround a typical mitochondrion?", "Two", ["One", "Three", "None"], "Mitochondria have distinct outer and inner membranes.", "easy"],
  ["What are cristae?", "Folds of the inner mitochondrial membrane", ["Stacks of Golgi sacs", "Protein fibres in a bacterial wall", "Pores in the nuclear envelope"], "Cristae increase the surface area available for electron transport and ATP production.", "easy"],
  ["What is the mitochondrial matrix?", "The compartment enclosed by the inner membrane", ["The space outside the cell", "The interior of a lysosome", "The plant cell wall"], "The matrix contains enzymes for pathways that break down fuel molecules.", "easy"],
  ["What is the main energy-related function of mitochondria?", "Aerobic ATP production", ["Synthesis of peptidoglycan", "Storage of all nuclear DNA", "Extracellular digestion"], "Mitochondria convert energy from nutrients into ATP through aerobic respiration.", "easy"],
  ["In which cells is a large central vacuole especially prominent?", "Plant cells", ["Bacterial cells", "Animal sperm only", "Viruses"], "A mature plant-cell vacuole can occupy most of the cell's internal volume.", "easy"],
  ["What does a contractile vacuole remove from many freshwater protists?", "Excess water", ["Chromosomes", "Cellulose", "Ribosomes"], "Contractile vacuoles collect and expel incoming water to maintain osmotic balance.", "easy"],
  ["What is the intermembrane space of a mitochondrion?", "The compartment between outer and inner membranes", ["The space within a chloroplast granum", "The nuclear interior", "The cytosol outside all organelles"], "The two mitochondrial membranes define a narrow intermembrane compartment.", "medium"],
  ["How does the inner mitochondrial membrane differ from the outer membrane?", "It is highly selective and contains major energy-conversion proteins", ["It is made of peptidoglycan", "It contains no proteins", "It is freely permeable to all ions"], "The inner membrane maintains gradients and houses the respiratory electron-transfer machinery.", "medium"],
  ["Where are many fuel-oxidation enzymes located in mitochondria?", "Matrix", ["Cell wall", "Nucleolus", "Golgi lumen"], "Matrix enzymes process pyruvate and fatty-acid products before electron transport.", "medium"],
  ["Which mitochondrial structure directly contains the electron-transport chain?", "Inner membrane", ["Outer cell wall", "Vacuolar membrane only", "Nuclear pore"], "Respiratory complexes are embedded in the inner mitochondrial membrane.", "medium"],
  ["Which substances may be stored in a plant vacuole?", "Water, salts, pigments, wastes and reserve compounds", ["Only chromosomes", "Only oxygen", "Peptidoglycan and bacterial pili"], "Vacuoles are versatile storage compartments for soluble materials.", "medium"],
  ["How does the central vacuole support a non-woody plant?", "Water accumulation generates turgor pressure", ["It forms a bony skeleton", "It produces bacterial flagella", "It prevents all osmosis"], "Vacuolar water presses the protoplast against the cell wall and helps maintain rigidity.", "medium"],
  ["What is the function of a food vacuole in a protist?", "Digestion of ingested material", ["Replication of nuclear DNA", "Production of spindle fibres", "Secretion of cellulose walls"], "Food particles are enclosed and digested within a membrane-bound compartment.", "medium"],
  ["A mutation greatly reduces cristae formation. Which capacity is most likely reduced?", "Oxidative ATP production", ["Peptidoglycan synthesis", "Chromosome transcription in the nucleus", "Golgi glycosylation"], "Fewer cristae mean less inner-membrane area for electron transport and ATP synthase.", "hard"],
  ["A freshwater protist loses contractile-vacuole function. What is the likely consequence?", "Water accumulates and the cell may swell or burst", ["The cell becomes dehydrated immediately", "Mitosis becomes meiosis", "Chlorophyll is produced"], "Freshwater enters by osmosis and must be expelled to prevent excessive swelling.", "hard"],
  ["A seed cannot mobilize proteins stored in its vacuoles during germination. What is most directly limited?", "Supply of amino acids for early growth", ["Formation of bacterial pili", "Crossing over", "Synthesis of peptidoglycan"], "Stored proteins are normally hydrolysed to provide building blocks before the seedling is self-sufficient.", "hard"],
  ["Which molecule serves as the final electron acceptor in aerobic respiration?", "Oxygen", ["Glucose", "ATP", "Carbon dioxide"], "Oxygen accepts electrons and protons at the end of the respiratory electron-transport chain.", "easy", G],
  ["What is chemiosmosis in mitochondria?", "Use of a proton gradient to drive ATP synthesis", ["Diffusion of chromosomes into the nucleus", "Digestion in a food vacuole", "Formation of a cell wall"], "Protons returning through ATP synthase provide energy to phosphorylate ADP.", "medium", G],
  ["Which observation supports the endosymbiotic origin of mitochondria?", "They possess their own DNA and bacterial-like ribosomes", ["They occur outside every cell", "They contain cellulose walls", "They form directly from Golgi sacs"], "Mitochondrial genetic and division features resemble those of bacterial ancestors.", "medium", G],
  ["A poison blocks the mitochondrial electron-transport chain. Why does ATP production fall sharply?", "The proton gradient that powers ATP synthase cannot be maintained", ["Ribosomes can no longer contain RNA", "The nucleus loses all chromosomes", "The vacuole cannot store pigment"], "Electron transport pumps protons; blocking it collapses the energy source for oxidative phosphorylation.", "hard", G],
]);

// Study Session 10 (20)
addSession("Chloroplasts and Microbodies", 10, [
  ["What is the main function of a chloroplast?", "Photosynthesis", ["Protein digestion", "Mitosis", "Bacterial conjugation"], "Chloroplasts capture light energy and use it to support carbohydrate production.", "easy"],
  ["Which genetic structures occur inside chloroplasts?", "Their own DNA and ribosomes", ["A eukaryotic nucleus", "Peptidoglycan chromosomes", "Lysosomal enzymes only"], "Chloroplasts retain a small genome and protein-synthesis machinery.", "easy"],
  ["What is a thylakoid?", "A flattened membrane sac inside a chloroplast", ["A fold of the mitochondrial outer membrane", "A fungal hypha", "A nuclear pore"], "Thylakoid membranes contain pigments and protein complexes used in the light reactions.", "easy"],
  ["What is a granum?", "A stack of thylakoids", ["The fluid inside a mitochondrion", "A cluster of lysosomes", "A bacterial capsule"], "Multiple thylakoid discs arranged together form a granum.", "easy"],
  ["What is the stroma?", "The fluid compartment surrounding the thylakoids in a chloroplast", ["The acidic interior of a lysosome", "The space between nuclear membranes", "A fungal cell wall"], "The stroma contains enzymes involved in carbon fixation and other chloroplast processes.", "easy"],
  ["Which chloroplast pigment captures light energy?", "Chlorophyll", ["Chitin", "Glycogen", "Peptidoglycan"], "Chlorophyll absorbs wavelengths that power photosynthetic electron transfer.", "easy"],
  ["How is a chloroplast membrane arrangement similar to that of a mitochondrion?", "Both organelles have outer and inner boundary membranes", ["Both contain lysosomal acid hydrolases", "Both are surrounded by peptidoglycan", "Both lack internal membranes"], "Their double envelopes are consistent with endosymbiotic origins.", "medium"],
  ["Which eukaryotic organisms besides plants may possess chloroplasts?", "Photosynthetic protists", ["All animals", "All fungi", "Viruses"], "Many algae and other photosynthetic protists contain chloroplasts.", "medium"],
  ["Why is bacterial chlorophyll not considered a chloroplast?", "Bacteria lack membrane-bound organelles", ["Bacteria cannot capture light", "Chlorophyll contains no pigment", "Every bacterium has a nucleus"], "Some bacteria photosynthesize, but their photosynthetic membranes are not enclosed as chloroplasts.", "medium"],
  ["What is a microbody?", "A small single-membrane organelle containing metabolic enzymes", ["A bacterial chromosome", "A thylakoid stack", "A ribosomal subunit"], "Microbodies compartmentalize reactions involving enzymes such as oxidases and catalase.", "medium"],
  ["Which enzyme is especially abundant in peroxisomes?", "Catalase", ["Cellulase", "DNA ligase only", "Pepsin"], "Catalase converts harmful hydrogen peroxide into water and oxygen.", "medium"],
  ["What do peroxisomes commonly oxidize?", "Fatty acids and selected amino acids", ["Whole chromosomes", "Cellulose cell walls", "Ribosomal RNA"], "Peroxisomal oxidation generates hydrogen peroxide that must be detoxified.", "medium"],
  ["What is a major function of glyoxysomes in germinating seeds?", "Converting stored fats into carbohydrate precursors", ["Producing sperm", "Digesting bacterial walls", "Separating chromosomes"], "The glyoxylate cycle allows young seedlings to use lipid reserves to support sugar production.", "medium"],
  ["An herbicide disrupts thylakoid electron transport. Which process is most directly inhibited?", "Light-driven production of ATP and reducing power", ["Translation on cytosolic ribosomes", "Mitosis in root cells only", "Lysosomal digestion"], "Photosynthetic electron transport occurs in thylakoid membranes.", "hard"],
  ["A cell lacks functional catalase in its peroxisomes. Which compound is most likely to accumulate?", "Hydrogen peroxide", ["Peptidoglycan", "Chlorophyll", "Messenger RNA"], "Catalase normally decomposes toxic hydrogen peroxide generated by oxidative reactions.", "hard"],
  ["A germinating oil-rich seed has defective glyoxysomes. What difficulty is expected before photosynthesis begins?", "Poor conversion of stored lipid into usable carbohydrate", ["Excess formation of bacterial pili", "Failure of nuclear pores", "Immediate chromosome doubling"], "Glyoxysomes help mobilize fat reserves into substrates that support early seedling growth.", "hard"],
  ["Where do the light-dependent reactions of photosynthesis occur?", "Thylakoid membrane", ["Nuclear envelope", "Lysosomal lumen", "Cell wall"], "Photosystems, electron carriers and ATP synthase are embedded in thylakoid membranes.", "easy", G],
  ["Where does the Calvin cycle occur?", "Chloroplast stroma", ["Mitochondrial intermembrane space", "Golgi lumen", "Nucleolus"], "Stromal enzymes use ATP and NADPH to fix carbon dioxide into organic molecules.", "medium", G],
  ["How are photosynthesis and cellular respiration complementary at the ecosystem level?", "Products of one process serve as reactants for the other", ["Both consume oxygen and release no carbon dioxide", "Neither transforms energy", "Only animals perform either process"], "Photosynthesis stores energy in organic matter and releases oxygen; respiration uses organic matter and oxygen.", "medium", G],
  ["Which observation most strongly supports chloroplast endosymbiosis?", "Chloroplasts divide independently and contain bacterial-like DNA and ribosomes", ["Chloroplasts occur in every animal cell", "They are made by lysosomes", "They contain no membranes"], "Multiple bacterial-like features are best explained by descent from an engulfed photosynthetic prokaryote.", "hard", G],
]);

// Study Session 11 (20)
addSession("Cell Cycle, Mitosis and Meiosis", 11, [
  ["Which phases make up interphase?", "G1, S and G2", ["Prophase, metaphase and anaphase", "Meiosis I and II", "Cytokinesis only"], "During G1, S and G2 the cell grows, duplicates DNA and prepares for division.", "easy"],
  ["During which cell-cycle phase is DNA replicated?", "S phase", ["G1 phase", "Cytokinesis", "G0 phase"], "The S, or synthesis, phase duplicates chromosomal DNA.", "easy"],
  ["What two processes make up the M phase?", "Mitosis and cytokinesis", ["Transcription and translation", "G1 and S", "Fertilization and meiosis"], "Mitosis separates nuclear chromosomes and cytokinesis divides the cytoplasm.", "easy"],
  ["What is G0?", "A quiescent state outside active division", ["The phase of DNA replication", "The final stage of meiosis II", "A type of chromosome"], "Cells in G0 have left the active cycle temporarily or for an extended period.", "easy"],
  ["What does mitosis normally produce?", "Two genetically similar daughter nuclei", ["Four genetically varied haploid cells", "One cell with no DNA", "Two bacterial plasmids"], "Mitosis distributes duplicated chromosomes so each daughter receives an equivalent set.", "easy"],
  ["What does meiosis normally produce from one diploid precursor?", "Four haploid cells", ["Two identical diploid cells", "One tetraploid cell", "Eight cells without chromosomes"], "Two meiotic divisions reduce chromosome number and yield four haploid products.", "easy"],
  ["What happens during prophase of mitosis?", "Chromosomes condense and the spindle begins to form", ["Sister chromatids reach opposite poles", "DNA is replicated", "Gametes fuse"], "Prophase prepares condensed chromosomes and the division apparatus for segregation.", "medium"],
  ["What is the defining event of metaphase?", "Chromosomes align at the metaphase plate", ["Chromosomes replicate", "Nuclear envelopes fully reform", "Cytoplasm divides"], "Spindle attachment positions chromosomes at the cell equator before separation.", "medium"],
  ["What separates during anaphase of mitosis?", "Sister chromatids", ["Homologous pairs only", "Cell walls", "Nucleoli without chromosomes"], "Centromere-linked sister chromatids move to opposite spindle poles.", "medium"],
  ["What occurs during telophase?", "Nuclear envelopes reform around separated chromosomes", ["DNA replication begins", "Homologous chromosomes pair", "Crossing over occurs"], "Chromosomes reach the poles, decondense and become enclosed in new nuclei.", "medium"],
  ["How does cytokinesis differ in typical plant and animal cells?", "Plants form a cell plate; animals form a cleavage furrow", ["Plants use no cytoskeleton", "Animals build a cellulose plate", "Only plants divide cytoplasm"], "The rigid plant wall requires construction of a new dividing plate, whereas animal cells constrict.", "medium"],
  ["What separates during anaphase I of meiosis?", "Homologous chromosomes", ["Sister chromatids at every centromere", "Ribosomal subunits", "Plasma membranes"], "Meiosis I is reductional because homologous partners move to opposite cells while sisters remain together.", "medium"],
  ["During which prophase-I stage does crossing over occur?", "Pachytene", ["Leptotene", "Metaphase II", "Telophase I"], "Synapsed homologues exchange corresponding segments during pachytene.", "medium"],
  ["A homologous pair fails to separate in meiosis I. What can result?", "Gametes with abnormal chromosome numbers", ["Two perfectly identical diploid tissues", "Loss of all ribosomes", "A cell wall made of chitin"], "Nondisjunction sends both homologues to one pole and none to the other.", "hard"],
  ["Why does crossing over increase genetic variation?", "It creates new combinations of alleles on homologous chromosomes", ["It doubles the chromosome number", "It makes all gametes identical", "It removes every mutation"], "Exchange between nonsister chromatids produces recombinant chromosomes.", "hard"],
  ["A species has four homologous chromosome pairs. How many chromosome combinations can independent assortment alone produce in gametes?", "16", ["4", "8", "32"], "Independent orientation produces 2^n combinations; with n = 4, 2^4 = 16.", "hard"],
  ["What is a cell-cycle checkpoint?", "A control point that assesses whether the cell can safely proceed", ["A permanent break in DNA", "A ribosomal protein", "A type of gamete"], "Checkpoints monitor conditions such as DNA integrity, replication completion and spindle attachment.", "easy", G],
  ["How can loss of cell-cycle control contribute to cancer?", "Damaged cells may continue dividing uncontrollably", ["Every cell permanently enters G0", "Meiosis replaces mitosis in all tissues", "Cells stop accumulating mutations"], "Failure of growth restraints and checkpoints permits abnormal cell proliferation.", "medium", G],
  ["What is apoptosis?", "Regulated programmed cell death", ["Uncontrolled chromosome replication", "Bacterial conjugation", "Passive diffusion"], "Apoptosis removes selected cells through an organized cellular process.", "medium", G],
  ["A drug prevents spindle microtubules from attaching to kinetochores. Which outcome is most likely?", "The spindle checkpoint halts chromosome segregation", ["DNA is translated into protein", "The cell completes normal anaphase", "Homologues perform photosynthesis"], "Unattached kinetochores signal that chromosomes are not ready for accurate separation.", "hard", G],
]);

// Study Session 12 (20)
addSession("Heredity and Mendelian Principles", 12, [
  ["What is heredity?", "Transmission of traits from parents to offspring", ["Removal of metabolic wastes", "Cellular digestion", "Classification by habitat"], "Genes carry biological information across generations.", "easy"],
  ["What is a gene?", "A hereditary DNA sequence influencing a functional product or trait", ["A complete cell membrane", "A type of lipid", "An environmental factor only"], "Genes are units of inherited information encoded in DNA.", "easy"],
  ["What are alleles?", "Alternative forms of a gene", ["Different organelles", "Identical chromosomes from one gamete", "Types of cell walls"], "Alleles occupy corresponding loci and may produce different trait outcomes.", "easy"],
  ["What is genotype?", "The allele composition of an organism", ["Only its visible appearance", "Its habitat", "Its metabolic waste"], "Genotype specifies the inherited genetic variants carried by an individual.", "easy"],
  ["What is phenotype?", "The observable or measurable expression of traits", ["The full set of unexpressed alleles only", "A chromosome location", "The process of meiosis"], "Phenotype arises from genotype interacting with developmental and environmental conditions.", "easy"],
  ["What does homozygous mean?", "Having two identical alleles at a locus", ["Having two different alleles", "Having no chromosomes", "Having four gametes"], "Examples include TT and tt for a two-allele locus.", "easy"],
  ["What does heterozygous mean?", "Having two different alleles at a locus", ["Having identical alleles", "Lacking a phenotype", "Carrying no genes"], "A heterozygote such as Tt carries two alternative alleles.", "medium"],
  ["What is a dominant allele under complete dominance?", "An allele expressed in the heterozygous phenotype", ["An allele expressed only when homozygous", "An allele that destroys every other gene", "An allele found only in males"], "One copy of a completely dominant allele is sufficient for its associated phenotype.", "medium"],
  ["When is a recessive phenotype expressed under complete dominance?", "When no dominant allele is present", ["Whenever one dominant allele is present", "Only during meiosis I", "In every heterozygote"], "A recessive phenotype usually requires two recessive alleles in a diploid organism.", "medium"],
  ["What does Mendel's law of segregation state?", "The two alleles of a gene separate during gamete formation", ["Every gamete receives both alleles", "Linked genes always assort independently", "Dominant alleles destroy recessive alleles"], "Each gamete receives one allele from a diploid individual's pair.", "medium"],
  ["What does independent assortment describe?", "Different chromosome pairs can orient independently during meiosis", ["Sister chromatids never separate", "Every gene is inherited together", "All offspring have one phenotype"], "Random orientation of homologous pairs generates different maternal-paternal combinations.", "medium"],
  ["What is the F1 generation?", "The first offspring generation from a parental cross", ["The original parents", "The offspring of two F2 individuals", "A mitotic phase"], "F1 denotes the first filial descendants of the selected parents.", "medium"],
  ["What happens in incomplete dominance?", "A heterozygote has an intermediate phenotype", ["One allele completely masks the other", "Both alleles disappear", "No genotype produces a phenotype"], "Neither allele is fully dominant, so the heterozygote differs from both homozygotes.", "medium"],
  ["Why may two genes fail to assort independently?", "They may be closely linked on the same chromosome", ["They contain no DNA", "All alleles are recessive", "They occur in different organisms"], "Nearby loci are less likely to be separated by crossing over and can be inherited together.", "hard"],
  ["Two genetically identical plants grow to different heights under different nutrient conditions. What explains the difference?", "Environmental effects on phenotype", ["They must have different alleles", "Genes have no role in growth", "Mitosis changes one into another species"], "Phenotype can vary when the same genotype develops in different environments.", "hard"],
  ["An organism has three homologous chromosome pairs. How many combinations can independent assortment produce before crossing over?", "8", ["3", "6", "9"], "The number is 2^n; for n = 3 homologous pairs, 2^3 = 8.", "hard"],
  ["What is a gene locus?", "The physical position of a gene on a chromosome", ["The visible form of a trait", "A whole gamete", "A cell-cycle phase"], "Alleles of a gene occupy the same locus on homologous chromosomes.", "easy", G],
  ["What is a test cross used for?", "Determining an unknown dominant-phenotype genotype by crossing with a homozygous recessive", ["Producing only dominant offspring", "Measuring chromosome size", "Preventing segregation"], "Recessive offspring reveal that the tested parent contributed a recessive allele.", "medium", G],
  ["What is a pedigree?", "A diagram tracing a trait through generations of a family", ["A map of cell organelles", "A list of bacterial shapes", "A graph of enzyme rate only"], "Pedigrees help infer inheritance patterns from relationships and phenotypes.", "medium", G],
  ["A disease allele is present, but some carriers show no symptoms. Which concept best explains this?", "Incomplete penetrance", ["Binary fission", "Cell-wall synthesis", "Complete absence of genotype"], "Penetrance describes the proportion of individuals with a genotype who express its associated phenotype.", "hard", G],
]);

// Study Session 13 (20)
addSession("Mendelian Crosses and Genetic Probability", 13, [
  ["What is a monohybrid cross?", "A genetic cross following one character", ["A cross following three unrelated species", "A form of asexual reproduction", "A division producing no gametes"], "A monohybrid cross examines inheritance at one trait or locus.", "easy"],
  ["What is a dihybrid cross?", "A genetic cross following two characters", ["A cross involving one allele only", "Fusion of identical cells", "A bacterial division"], "A dihybrid cross simultaneously tracks two gene pairs.", "easy"],
  ["What does F1 mean?", "First filial generation", ["Final chromosome", "First fertilization enzyme", "Fourth inherited locus"], "F1 is the first generation of offspring produced from a parental cross.", "easy"],
  ["Which offspring are called the second filial or F2 generation?", "Those produced by crossing or selfing F1 individuals", ["The original parental generation", "Cells in a second mitotic phase", "Gametes before the parental cross"], "The second filial generation follows reproduction among F1 individuals.", "easy"],
  ["If TT is crossed with tt, what is the genotype of every F1 offspring?", "Tt (heterozygous)", ["TT (homozygous dominant)", "tt (homozygous recessive)", "Half TT and half tt"], "Each offspring receives T from one parent and t from the other.", "easy"],
  ["Under complete dominance, what phenotype does Tt show if T represents tallness?", "Tall", ["Short", "Medium height necessarily", "No height phenotype"], "One dominant T allele is sufficient for the tall phenotype.", "easy"],
  ["What phenotypic ratio is expected from Tt × Tt under complete dominance?", "3 dominant : 1 recessive", ["1 dominant : 1 recessive", "1 : 2 : 1 phenotypes", "All recessive"], "TT and two Tt classes are dominant, while tt is recessive.", "medium"],
  ["What genotypic ratio is expected from Tt × Tt?", "1 TT : 2 Tt : 1 tt", ["3 TT : 1 tt", "1 Tt : 1 tt", "All Tt"], "The four equally likely combinations are TT, Tt, Tt and tt.", "medium"],
  ["Which gametes can a Tt individual produce?", "T and t", ["Tt only", "TT and tt", "T, t and Tt"], "Alleles segregate so each gamete carries one allele.", "medium"],
  ["Which gametes can an RrSs individual produce if the genes assort independently?", "RS, Rs, rS and rs", ["Rr and Ss only", "RR, Rr, SS and Ss", "RrSs only"], "Each gamete receives one allele at each locus, yielding four combinations.", "medium"],
  ["What phenotypic ratio is expected from RrSs × RrSs with complete dominance and independent assortment?", "9:3:3:1", ["3:1", "1:2:1", "1:1:1:1"], "Combining two independent 3:1 trait ratios produces four phenotype classes in a 9:3:3:1 ratio.", "medium"],
  ["Which genotype expresses both recessive traits in an R/r, S/s dihybrid cross?", "rrss (double homozygous recessive)", ["RrSs (double heterozygous)", "RRSS (double homozygous dominant)", "Rrss (recessive at one locus)"], "A recessive phenotype at each locus requires homozygosity for both recessive alleles.", "medium"],
  ["In Tt × Tt, what is the probability of a recessive tt offspring?", "1/4", ["1/2", "3/4", "1"], "One of the four equally likely Punnett-square combinations is tt.", "medium"],
  ["A tall plant of unknown genotype crossed with tt produces a short offspring. What must the tall parent's genotype be?", "Tt (heterozygous)", ["TT (homozygous dominant)", "tt (homozygous recessive)", "Either TT or no allele"], "The short offspring received t from both parents, so the tall parent carried a recessive t allele.", "hard"],
  ["In RrSs × RrSs, what is the probability of an offspring recessive for both independently assorting traits?", "1/16", ["1/4", "3/16", "9/16"], "The chance of rr is 1/4 and of ss is 1/4; multiplying gives 1/16.", "hard"],
  ["Two pink flowers showing incomplete dominance are crossed. What phenotypic ratio is expected?", "1 red : 2 pink : 1 white", ["3 red : 1 white", "All pink", "9:3:3:1"], "The heterozygote has its own intermediate phenotype, so genotype and phenotype ratios are both 1:2:1.", "hard"],
  ["What is a Punnett square?", "A grid used to display possible allele combinations in offspring", ["A microscope field", "A chart of cell organelles", "A classification hierarchy"], "Punnett squares organize gamete combinations to predict genetic probabilities.", "easy", G],
  ["What does the multiplication rule calculate in genetic probability?", "The probability that independent events occur together", ["The number of chromosomes in one cell", "The effect of one dominant allele", "The size of a gene"], "For independent events, their joint probability is the product of their individual probabilities.", "medium", G],
  ["Why is a chi-square test used with genetic-cross data?", "To assess whether observed deviations from an expected ratio are plausibly due to chance", ["To guarantee Mendel's model", "To change offspring genotypes", "To count only dominant phenotypes"], "Chi-square compares observed and expected counts while accounting for sample variation.", "medium", G],
  ["A test cross produces mostly parental combinations and few recombinants. What is the best explanation?", "The two genes are linked but sometimes separated by crossing over", ["The genes are on different chromosomes and assort perfectly", "Meiosis did not occur", "Every recombinant is lethal by definition"], "Linked loci travel together frequently; recombinant frequency reflects crossing over between them.", "hard", G],
]);

// Study Session 14 (20)
addSession("Sexual and Asexual Reproduction", 14, [
  ["Which life process ensures lineage continuity by producing new individuals?", "Reproduction", ["Excretion", "Homeostasis", "Classification"], "Reproduction produces offspring and continues a biological lineage.", "easy"],
  ["What defines asexual reproduction?", "Offspring arise without fusion of genetic material from two gametes", ["It always requires two parents", "It produces only haploid organisms", "It occurs only in animals"], "Asexual reproduction uses one genetic source and often produces closely similar offspring.", "easy"],
  ["What defines sexual reproduction?", "Genetic material from gametes is combined to form offspring", ["One cell splits without genetic recombination", "No chromosomes are involved", "Only bacteria can perform it"], "Sexual reproduction combines hereditary contributions through gamete fusion.", "easy"],
  ["Which reproductive method is typical of many bacteria?", "Binary fission", ["Pollination", "Meiosis followed by fertilization", "Allogamy"], "A bacterial cell commonly duplicates its DNA and divides into two cells.", "easy"],
  ["Which asexual method is common in yeast?", "Budding", ["Conjugation as reproduction", "Gametogenesis", "Cross-pollination"], "A new yeast cell can grow as a bud from the parent and separate.", "easy"],
  ["What is parthenogenesis?", "Development of an offspring from an unfertilized reproductive cell", ["Fusion of gametes from two parents", "Growth of a bacterial cell wall", "Transfer of a plasmid"], "Parthenogenesis produces an embryo without fertilization.", "easy"],
  ["Why are asexual offspring often genetically similar to the parent?", "They receive genetic material from one parental lineage without gamete fusion", ["Asexual reproduction removes DNA", "All mutations are impossible", "They receive half a genome from two parents"], "Mitotic or related copying mechanisms preserve much of the parental genotype.", "medium"],
  ["Why are gametes typically haploid?", "Fusion restores the diploid chromosome number instead of doubling it each generation", ["Haploid cells contain no genes", "Gametes must perform mitosis only", "Diploid cells cannot reproduce"], "Meiosis halves chromosome number before fertilization combines two genomes.", "medium"],
  ["What characterizes anisogamy?", "The fusing gametes differ in size or form", ["The gametes are morphologically identical", "No gametes are involved", "Only one chromosome is inherited"], "Sperm and ova are common examples of differentiated anisogamous gametes.", "medium"],
  ["What characterizes isogamy?", "The fusing gametes are similar in size and form", ["The gametes come from no cells", "One gamete is always an ovum", "Fertilization does not occur"], "Isogamous species have morphologically similar mating cells, though mating types may differ.", "medium"],
  ["What is allogamy?", "Fertilization between gametes from different individuals", ["Self-fertilization within one individual", "Asexual budding", "Binary fission"], "Allogamy combines gametes contributed by separate parents.", "medium"],
  ["What is autogamy?", "Self-fertilization using gametes from the same individual", ["Fertilization between species", "Reproduction without gametes", "Division of a bacterium"], "Autogamy occurs in some hermaphroditic organisms and self-compatible plants.", "medium"],
  ["Why does sexual reproduction commonly increase variation among offspring?", "Meiosis and fertilization create new allele combinations", ["It copies one parental genome unchanged", "It prevents mutation", "It removes independent assortment"], "Recombination, assortment and random gamete fusion reshuffle genetic information.", "medium"],
  ["Why is parthenogenesis not the same as autogamy?", "Parthenogenesis requires no fertilization, whereas autogamy involves fusion of gametes from one individual", ["Both always involve two parents", "Autogamy is binary fission", "Parthenogenesis requires sperm from another individual"], "The presence or absence of gamete fusion distinguishes the two processes.", "hard"],
  ["A clonal population encounters a new disease. Why may it be especially vulnerable?", "Low genetic variation may leave many individuals similarly susceptible", ["Clones contain no cells", "Asexual reproduction prevents infection", "Every clone has a unique genotype"], "Genetic uniformity reduces the chance that some individuals carry protective variants.", "hard"],
  ["Why can sexual reproduction persist despite requiring more time and energy than many asexual modes?", "Genetic variation can improve adaptation under changing conditions", ["It always produces more offspring immediately", "It guarantees every offspring survives", "It eliminates harmful alleles in one generation"], "The benefits of varied offspring can offset the costs of finding mates and producing gametes.", "hard"],
  ["What is fragmentation?", "Asexual reproduction in which body pieces develop into new individuals", ["Fusion of two gametes", "Separation of homologous chromosomes", "Formation of an embryo after pollination only"], "Some organisms reproduce when fragments regenerate missing parts.", "easy", G],
  ["What does fertilization accomplish with respect to chromosome number?", "It combines haploid gametes to form a diploid zygote", ["It converts a diploid cell into four haploid cells", "It removes all chromosomes", "It duplicates each gamete without fusion"], "Gamete nuclei unite and restore the species' diploid complement.", "medium", G],
  ["What is reproductive assurance?", "The ability to reproduce when mates or pollinators are scarce", ["A guarantee that all offspring survive", "The prevention of every mutation", "A measure of cell size"], "Selfing or asexual reproduction can provide offspring when opportunities for outcrossing are limited.", "medium", G],
  ["An environment changes unpredictably between generations. Which reproductive strategy may offer a population-level advantage?", "Producing genetically varied offspring through sexual reproduction", ["Producing one permanently identical genotype only", "Stopping reproduction", "Eliminating recombination"], "Variation increases the probability that some offspring are suited to future conditions.", "hard", G],
]);

// Study Session 15 (20)
addSession("Biological Interactions and Community Ecology", 15, [
  ["What is a biological interaction?", "An effect that organisms living in a community have on one another", ["A chemical reaction with no organisms", "A chromosome inside one cell", "A type of cell division"], "Interactions change the survival, growth or reproduction of one or both participants.", "easy"],
  ["What is an intraspecific interaction?", "An interaction among members of the same species", ["An interaction between different species", "A reaction inside a mitochondrion", "A cross between two genes"], "The prefix intra- indicates interaction within one species.", "easy"],
  ["What is an interspecific interaction?", "An interaction between members of different species", ["An interaction within one organism", "A process involving one chromosome", "A form of mitosis"], "The prefix inter- indicates interaction across species.", "easy"],
  ["What is predation?", "One organism kills and consumes another", ["Both organisms benefit", "One benefits while the other is unaffected", "Both organisms are unaffected"], "A predator obtains food by capturing prey.", "easy"],
  ["What is mutualism?", "An interaction in which both species benefit", ["One benefits and one is harmed", "Both are harmed", "Neither is affected"], "Mutualistic partners each gain a fitness benefit from the association.", "easy"],
  ["What is commensalism?", "One species benefits while the other is not significantly affected", ["Both species benefit", "One kills and eats the other", "Both compete and are harmed"], "In commensalism the net effects are conventionally represented as positive and neutral.", "easy"],
  ["What is neutralism?", "An interaction with negligible detectable effect on either species", ["Both species gain an obligatory benefit", "One organism lives at another's expense", "Both lose access to a limiting resource"], "True neutral effects are difficult to prove, so the term is used for insignificant net effects.", "medium"],
  ["What is amensalism?", "One species is harmed while the other is unaffected", ["Both species benefit", "One benefits and one is harmed", "Both are unaffected"], "Trampling grass can harm the plant while having negligible effect on the animal.", "medium"],
  ["What is competition?", "A negative interaction caused by shared demand for a limiting resource", ["An interaction in which both always gain", "A process with no effect on fitness", "Gamete fusion"], "Competitors reduce each other's access to food, space, mates or other scarce resources.", "medium"],
  ["What is symbiosis in its broad biological sense?", "A close, persistent association between different species", ["Any brief event within one species", "Only an interaction beneficial to both", "A type of cell wall"], "Symbiosis describes close interspecific living arrangements whose effects can vary.", "medium"],
  ["Which prey feature can evolve under predation pressure?", "Camouflage or warning coloration", ["Loss of every sensory response", "Elimination of reproduction", "A bacterial nucleoid"], "Predators select for traits that improve prey detection avoidance or defence.", "medium"],
  ["Nitrogen-fixing bacteria in legume root nodules illustrate which interaction?", "Mutualism", ["Predation", "Amensalism", "Neutralism"], "The plant receives usable nitrogen while bacteria receive resources and a protected habitat.", "medium"],
  ["A remora eats scraps from a shark without measurably affecting it. Which interaction is illustrated?", "Commensalism", ["Parasitism", "Competition", "Mutualism"], "The remora benefits and the shark is treated as neutral in the example.", "medium"],
  ["An organism benefits while reducing its host's fitness without immediately killing it. Which interaction fits best?", "Parasitism", ["Mutualism", "Neutralism", "Commensalism"], "A parasite obtains resources from a host and imposes harm.", "hard"],
  ["Two species occupy the same limiting niche indefinitely with no differentiation. What principle predicts instability?", "Competitive exclusion principle", ["Law of segregation", "Cell theory", "Fluid mosaic model"], "Complete competitors cannot coexist stably if one consistently uses the limiting resource more effectively.", "hard"],
  ["Removing a predator causes herbivores to increase and plants to decline. What does this demonstrate?", "An indirect ecological effect across trophic levels", ["Independent assortment", "Binary fission", "Cellular respiration only"], "The predator affects plants indirectly by controlling herbivore abundance.", "hard"],
  ["What is an ecological niche?", "A species' role, requirements and use of environmental resources", ["Only the geographic place it occupies", "A single gene", "A cell organelle"], "A niche includes conditions tolerated, resources used and interactions with other organisms.", "easy", G],
  ["What is a keystone species?", "A species with an effect on community structure disproportionate to its abundance", ["The most numerous species by definition", "A species with no interactions", "Any organism used in a laboratory"], "Removing a keystone species can trigger large community changes.", "medium", G],
  ["What is a trophic cascade?", "A chain of indirect effects moving through feeding levels", ["A sequence of mitotic stages", "A type of genetic cross", "A flow of water through one cell"], "Changes in predators can propagate to herbivores and producers.", "medium", G],
  ["A relationship is beneficial when food is abundant but becomes competitive during drought. What does this show?", "Interaction outcomes can depend on environmental context", ["Every interaction has a permanently fixed sign", "The species changed kingdoms", "Competition cannot occur within a community"], "Resource availability and other conditions can alter the costs and benefits experienced by partners.", "hard", G],
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
    id: deterministicUuid(`bio101-question-${index + 1}-${question.prompt}`),
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
      databaseCourseCode: "BIO 101",
      sourceCourseCode: "BIO 111",
    },
    generationMeta: {
      import: "codex_bio101_from_bio111_300_v1",
      sourceReference: question.sourceLabel,
      technicalAccuracyReviewCompleted: true,
      humanVerificationRequired: true,
    },
    options: question.options.map((text, optionIndex) => ({
      id: deterministicUuid(`bio101-option-${index + 1}-${optionIndex}-${text}`),
      text,
      isCorrect: optionIndex === question.answerIndex,
      position: optionIndex,
    })),
  }));
}

function renderSql(rows) {
  const payload = JSON.stringify(rows);
  if (payload.includes("$bio101_questions$")) throw new Error("Unexpected SQL dollar tag in generated content.");
  return `-- BIO 101 Exam Sprint: import 300 curated MCQs into an empty private bank
-- Primary source: supplied BIO 111 General Biology I module, also used for the summer BIO 101 course.
-- The script creates a BIO 101 bank if none exists and refuses to overwrite existing questions.
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
  WHERE upper(regexp_replace(coalesce(course_code, ''), '[^A-Za-z0-9]', '', 'g')) = 'BIO101'
    AND delivery_mode = 'mock_exam'
    AND exam_campaign_key = 'supplementary-2026';

  IF v_set_count = 0 THEN
    INSERT INTO public.study_quiz_sets
      (title, description, course_code, level, semester, difficulty, time_limit_minutes,
       questions_count, published, visibility, source, delivery_mode, exam_campaign_key,
       access_tier, exam_question_count, diagnostic_question_count, diagnostic_time_limit_minutes)
    VALUES
      ('BIO 101 Exam Sprint Mock',
       'Private BIO 101 bank based on the BIO 111 General Biology I module used for the summer course, with broader General Biology I enrichment.',
       'BIO 101', '100', 'first', 'hard', 40,
       0, false, 'private', 'exam_sprint', 'mock_exam', 'supplementary-2026',
       'plus_monthly', 40, 10, 10)
    RETURNING id INTO v_set_id;
  ELSIF v_set_count = 1 THEN
    SELECT id INTO v_set_id
    FROM public.study_quiz_sets
    WHERE upper(regexp_replace(coalesce(course_code, ''), '[^A-Za-z0-9]', '', 'g')) = 'BIO101'
      AND delivery_mode = 'mock_exam'
      AND exam_campaign_key = 'supplementary-2026'
    LIMIT 1;
  ELSE
    RAISE EXCEPTION 'More than one BIO 101 Exam Sprint bank exists. Keep one target bank before importing.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.study_quiz_questions
    WHERE coalesce(set_id, quiz_set_id) = v_set_id
  ) THEN
    RAISE EXCEPTION 'The BIO 101 target bank already contains questions. Import stopped to prevent duplicates.';
  END IF;

  FOR v_question IN
    SELECT value FROM jsonb_array_elements($bio101_questions$${payload}$bio101_questions$::jsonb)
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
  SET questions_count = 300,
      exam_question_count = 40,
      time_limit_minutes = 40,
      published = false,
      visibility = 'private',
      updated_at = now()
  WHERE id = v_set_id;
END
$import$;

COMMIT;

-- Expected: 300 questions, 1200 options, 300 correct options, 0 verified before admin review.
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
WHERE upper(regexp_replace(coalesce(s.course_code, ''), '[^A-Za-z0-9]', '', 'g')) = 'BIO101'
  AND s.delivery_mode = 'mock_exam'
  AND s.exam_campaign_key = 'supplementary-2026'
GROUP BY s.id, s.title;
`;
}

function renderMarkdown() {
  const lines = [
    "# BIO 101 — 300-question Exam Sprint bank",
    "",
    "Database course: BIO 101. Primary source: supplied BIO 111 General Biology I module used for the summer course.",
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
  const sourceKind = { supplied_bio111_material: 0, general_biology1: 0 };
  const topicCounts = new Map();
  const answerPositions = [0, 0, 0, 0];

  if (rows.length !== 300) errors.push(`Expected 300 questions; found ${rows.length}.`);
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

  if (difficulty.easy !== 105 || difficulty.medium !== 135 || difficulty.hard !== 60) {
    errors.push(`Difficulty balance is ${JSON.stringify(difficulty)}, expected 105/135/60.`);
  }
  if (sourceKind.supplied_bio111_material !== 240 || sourceKind.general_biology1 !== 60) {
    errors.push(`Source balance is ${JSON.stringify(sourceKind)}, expected 240/60.`);
  }
  if (topicCounts.size !== 15 || [...topicCounts.values()].some((count) => count !== 20)) {
    errors.push(`Expected 15 topics with 20 questions each; got ${JSON.stringify(Object.fromEntries(topicCounts))}.`);
  }
  if (answerPositions.some((count) => count !== 75)) {
    errors.push(`Answer positions are ${JSON.stringify(answerPositions)}, expected [75,75,75,75].`);
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
const sqlPath = resolve("deliverables/BIO101_import_exam_bank_300.sql");
const markdownPath = resolve("deliverables/BIO101_question_bank_300.md");
mkdirSync(dirname(sqlPath), { recursive: true });
writeFileSync(sqlPath, renderSql(rows), "utf8");
writeFileSync(markdownPath, renderMarkdown(), "utf8");
console.log(JSON.stringify({ ...summary, sqlPath, markdownPath }, null, 2));
