import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const bank = [];
const M = "supplied_material";
const G = "general_chm101";

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
      sourceLabel: sourceKind === M ? materialLabel : `General CHM 101 enrichment: ${topic}`,
      cognitive: difficulty === "easy" ? "recall" : difficulty === "hard" ? "analysis" : "application",
      questionKind: difficulty === "easy" ? "concept" : "application",
    });
  }
}

// 1. Chemical equations and reaction types (20)
addTopic("Chemical Equations and Reaction Types", "Unit 5a; CHM 101 Chemical Equation & Stoichiometry slides", [
  ["In a chemical equation, where are the reactants normally written?", "On the left side of the arrow", ["On the right side of the arrow", "Above the reaction arrow only", "Below the products"], "Reactants are written to the left of the reaction arrow, while products are written to the right.", "easy"],
  ["What does a coefficient placed before a chemical formula represent?", "The relative number of particles or moles", ["The charge on each atom", "The number of elements present", "The physical state of the substance"], "A coefficient gives the relative amount of a species without changing its chemical identity.", "easy"],
  ["Which symbol commonly separates reactants from products in a reaction proceeding forward?", "→", ["+", "=", "⇌"], "A right-pointing arrow shows the direction from reactants to products.", "easy"],
  ["Which state symbol represents an aqueous substance?", "(aq)", ["(s)", "(l)", "(g)"], "The symbol (aq) means the substance is dissolved in water.", "easy"],
  ["Why must a chemical equation be balanced?", "To obey conservation of atoms", ["To make every coefficient equal", "To remove all products", "To change compounds into elements"], "Atoms are rearranged in a reaction, not created or destroyed.", "easy"],
  ["Which reaction pattern represents decomposition?", "AB → A + B", ["A + B → AB", "AB + CD → AD + CB", "A + BC → AC + B"], "A decomposition reaction breaks one compound into two or more simpler substances.", "easy"],
  ["When balancing an equation, which quantities may be changed?", "Coefficients only", ["Subscripts only", "Element symbols only", "Charges on ions only"], "Changing a subscript changes chemical identity; balancing therefore uses coefficients.", "medium"],
  ["What is the smallest whole-number coefficient of O₂ when CH₄ + O₂ → CO₂ + H₂O is balanced?", "2", ["1", "3", "4"], "The balanced equation is CH₄ + 2O₂ → CO₂ + 2H₂O.", "medium"],
  ["Which equation is correctly balanced?", "2H₂ + O₂ → 2H₂O", ["H₂ + O₂ → H₂O", "H₂ + 2O₂ → H₂O", "2H₂ + 2O₂ → 2H₂O"], "The correct equation contains four H atoms and two O atoms on each side.", "medium"],
  ["The reaction Zn + CuSO₄ → ZnSO₄ + Cu is classified as what?", "Single displacement", ["Decomposition", "Double displacement", "Combustion"], "Zinc displaces copper from copper(II) sulfate.", "medium"],
  ["Which observation most directly indicates formation of a precipitate?", "An insoluble solid appears in solution", ["The container becomes empty", "Every ion becomes gaseous", "The solvent loses all mass"], "A precipitate is an insoluble solid formed from species initially in solution.", "medium"],
  ["What is the net ionic equation for mixing AgNO₃(aq) and NaCl(aq)?", "Ag⁺(aq) + Cl⁻(aq) → AgCl(s)", ["Na⁺ + NO₃⁻ → NaNO₃(s)", "Ag(s) + Cl₂(g) → AgCl(aq)", "AgNO₃(s) → Ag⁺ + NO₃⁻"], "Na⁺ and NO₃⁻ are spectator ions; AgCl is the insoluble product.", "medium"],
  ["Which species is a spectator ion in HCl(aq) + NaOH(aq) → NaCl(aq) + H₂O(l)?", "Na⁺", ["H⁺", "OH⁻", "H₂O"], "Na⁺ remains unchanged in solution; Cl⁻ is also a spectator ion.", "medium"],
  ["Balance Fe + O₂ → Fe₂O₃. What is the sum of the smallest whole-number coefficients?", "9", ["6", "7", "8"], "The balanced equation is 4Fe + 3O₂ → 2Fe₂O₃, whose coefficients sum to 9.", "hard"],
  ["When C₂H₆ burns completely, what coefficient is assigned to O₂ in the smallest whole-number equation?", "7", ["3", "5", "6"], "The balanced equation is 2C₂H₆ + 7O₂ → 4CO₂ + 6H₂O.", "hard"],
  ["Which name corresponds to Na₂CO₃?", "Sodium carbonate", ["Sodium carbonite", "Disodium carbide", "Sodium carbon oxide"], "Na₂CO₃ contains sodium ions and the carbonate ion.", "easy", G],
  ["What is the formula of aluminium sulfate?", "Al₂(SO₄)₃", ["AlSO₄", "Al₃SO₄", "Al(SO₄)₂"], "Two Al³⁺ ions balance three SO₄²⁻ ions.", "medium", G],
  ["In the complete ionic equation for BaCl₂(aq) + Na₂SO₄(aq), which ions form the precipitate?", "Ba²⁺ and SO₄²⁻", ["Na⁺ and Cl⁻", "Ba²⁺ and Cl⁻", "Na⁺ and SO₄²⁻"], "Barium sulfate is insoluble, whereas sodium and chloride ions remain spectators.", "medium", G],
  ["What coefficient of H₂O balances P₄ + O₂ → H₃PO₄ after all coefficients are made whole numbers?", "6", ["4", "8", "12"], "The balanced equation is P₄ + 5O₂ + 6H₂O → 4H₃PO₄.", "hard", G],
  ["Which balanced equation correctly represents thermal decomposition of potassium chlorate?", "2KClO₃ → 2KCl + 3O₂", ["KClO₃ → KCl + O₂", "2KClO₃ → K₂Cl₂ + O₃", "KClO₃ → K + Cl + 3O"], "Balancing oxygen requires 2KClO₃ and 3O₂ while K and Cl each have coefficient 2.", "hard", G],
]);

// 2. Mole concept and stoichiometric relationships (20)
addTopic("Mole Concept and Stoichiometric Relationships", "Unit 5b; CHM 101 UNIT 2; stoichiometry slides", [
  ["What number of entities is contained in one mole?", "6.022 × 10²³", ["3.011 × 10²³", "6.022 × 10²²", "1.000 × 10²³"], "One mole contains Avogadro's number, 6.022 × 10²³ entities.", "easy"],
  ["What information do coefficients in a balanced equation provide for stoichiometry?", "Mole ratios", ["Atomic radii", "Activation energies", "Electron configurations"], "Balanced coefficients give relative numbers of moles of reactants and products.", "easy"],
  ["What is the molar mass of H₂O?", "18 g mol⁻¹", ["16 g mol⁻¹", "20 g mol⁻¹", "34 g mol⁻¹"], "H₂O has two H atoms and one O atom: 2(1) + 16 = 18 g/mol.", "easy"],
  ["How many moles are present in 44 g of CO₂?", "1 mol", ["0.5 mol", "2 mol", "44 mol"], "The molar mass of CO₂ is 44 g/mol, so 44 g is one mole.", "easy"],
  ["For N₂ + 3H₂ → 2NH₃, what is the mole ratio H₂:NH₃?", "3:2", ["1:1", "2:3", "3:1"], "The coefficients give three moles of H₂ for every two moles of NH₃.", "easy"],
  ["Which expression converts mass to amount in moles?", "moles = mass ÷ molar mass", ["moles = mass × molar mass", "moles = molar mass ÷ mass", "moles = mass + molar mass"], "Amount in moles equals sample mass divided by molar mass.", "easy"],
  ["How many moles of O₂ are needed to react completely with 2 mol H₂ in 2H₂ + O₂ → 2H₂O?", "1 mol", ["0.5 mol", "2 mol", "4 mol"], "The stoichiometric ratio is 2 mol H₂ to 1 mol O₂.", "medium"],
  ["How many molecules are in 0.50 mol of O₂?", "3.011 × 10²³", ["6.022 × 10²³", "1.204 × 10²⁴", "8.00 × 10²²"], "Multiply 0.50 mol by Avogadro's number.", "medium"],
  ["What mass of NaOH is present in 0.25 mol if its molar mass is 40 g mol⁻¹?", "10 g", ["1.6 g", "40 g", "160 g"], "Mass = moles × molar mass = 0.25 × 40 = 10 g.", "medium"],
  ["For 2Al + 3I₂ → 2AlI₃, how many moles of I₂ react with 0.429 mol Al?", "0.644 mol", ["0.286 mol", "0.429 mol", "0.858 mol"], "0.429 × (3/2) = 0.6435 mol, which rounds to 0.644 mol.", "medium"],
  ["How many moles of NH₃ form from 4.0 mol Ca(OH)₂ in (NH₄)₂SO₄ + Ca(OH)₂ → 2NH₃ + CaSO₄ + 2H₂O?", "8.0 mol", ["2.0 mol", "4.0 mol", "16.0 mol"], "The equation gives two moles NH₃ per mole Ca(OH)₂.", "medium"],
  ["How many moles are in 11 g of CO₂?", "0.25 mol", ["0.50 mol", "2.0 mol", "4.0 mol"], "11 g ÷ 44 g/mol = 0.25 mol.", "medium"],
  ["How many oxygen atoms are present in 0.50 mol of CO₂?", "6.022 × 10²³", ["3.011 × 10²³", "1.204 × 10²⁴", "1.00 × 10²³"], "Each CO₂ has two O atoms, so 0.50 mol CO₂ contains 1.00 mol O atoms.", "medium"],
  ["What mass of Ga₂O₃ forms from 29.0 g Ga in 4Ga + 3O₂ → 2Ga₂O₃, using Ga = 69.7 and O = 16.0?", "About 39.0 g", ["19.5 g", "29.0 g", "58.0 g"], "29.0/69.7 mol Ga × (2/4) × 187.4 g/mol ≈ 39.0 g Ga₂O₃.", "hard"],
  ["What mass of CO is required for 25.13 g Fe₂O₃ in Fe₂O₃ + 3CO → 2Fe + 3CO₂, using Fe₂O₃ = 159.7 g mol⁻¹?", "About 13.22 g", ["4.41 g", "8.81 g", "25.13 g"], "25.13/159.7 × 3 × 28.0 ≈ 13.22 g CO.", "hard"],
  ["What is the percentage by mass of oxygen in H₂O?", "88.9%", ["11.1%", "50.0%", "94.1%"], "O contributes 16 of the 18 g/mol molar mass: 16/18 × 100 = 88.9%.", "easy", G],
  ["A compound contains 40.0% C, 6.7% H and 53.3% O. What is its empirical formula?", "CH₂O", ["C₂H₄O₂", "CHO", "CH₃O"], "For 100 g, the mole ratio is approximately 3.33:6.7:3.33 = 1:2:1.", "medium", G],
  ["An empirical formula is CH₂O and the molar mass is 180 g mol⁻¹. What is the molecular formula?", "C₆H₁₂O₆", ["CH₂O", "C₂H₄O₂", "C₃H₆O₃"], "The empirical-formula mass is 30; 180/30 = 6, so all subscripts multiply by six.", "medium", G],
  ["A 5.00 g impure CaCO₃ sample gives 1.76 g CO₂ on complete reaction. What is the percentage purity?", "80.0%", ["20.0%", "35.2%", "88.0%"], "1.76 g CO₂ is 0.0400 mol, requiring 4.00 g CaCO₃; purity = 4.00/5.00 × 100.", "hard", G],
  ["A hydrocarbon gives 8.8 g CO₂ and 5.4 g H₂O on complete combustion. What is its simplest C:H ratio?", "1:3", ["1:1", "1:2", "2:3"], "8.8 g CO₂ contains 0.20 mol C; 5.4 g H₂O contains 0.60 mol H atoms, giving C:H = 1:3.", "hard", G],
]);

// 3. Limiting reactants, yields and solution stoichiometry (20)
addTopic("Limiting Reactants, Yields and Solution Stoichiometry", "Unit 5b; CHM 101 UNIT 2", [
  ["What is a limiting reactant?", "The reactant consumed first", ["The reactant with the largest mass", "The product formed last", "A catalyst that slows the reaction"], "The limiting reactant is exhausted first and fixes the maximum product amount.", "easy"],
  ["What is an excess reactant?", "A reactant remaining after the limiting reactant is used", ["A product with high yield", "A substance absent from the equation", "The reactant with coefficient one"], "An excess reactant is supplied beyond the stoichiometric amount required.", "easy"],
  ["What does theoretical yield mean?", "Maximum product predicted by stoichiometry", ["Product actually collected", "Percentage of reactant remaining", "Mass of catalyst used"], "Theoretical yield assumes complete conversion according to the balanced equation.", "easy"],
  ["Which formula gives percentage yield?", "actual yield ÷ theoretical yield × 100", ["theoretical ÷ actual × 100", "actual + theoretical × 100", "reactant mass ÷ product mass"], "Percent yield compares collected product with the predicted maximum.", "easy"],
  ["What is molarity?", "Moles of solute per litre of solution", ["Grams of solvent per mole", "Litres of solute per gram", "Moles of solvent per kilogram of solution"], "Molarity M = n/V with solution volume in litres.", "easy"],
  ["Which reactant determines theoretical yield when reactants are not in stoichiometric proportions?", "The limiting reactant", ["The solvent", "The catalyst", "The excess reactant"], "Only the limiting reactant is fully consumed, so it determines product amount.", "easy"],
  ["A flask receives 2 mol hydrogen and 2 mol oxygen for water formation. Which gas is exhausted first?", "H₂", ["O₂", "H₂O", "Neither reactant"], "The equation 2H₂ + O₂ → 2H₂O shows that 2 mol H₂ consumes only 1 mol O₂; hydrogen is exhausted.", "medium"],
  ["How many moles of O₂ remain after 2 mol H₂ reacts with 2 mol O₂?", "1 mol", ["0 mol", "2 mol", "3 mol"], "The 2 mol H₂ consumes 1 mol O₂, leaving 1 mol O₂.", "medium"],
  ["If the theoretical yield is 10.0 g and the actual yield is 8.0 g, what is the percent yield?", "80%", ["20%", "100%", "125%"], "Percent yield = 8.0/10.0 × 100 = 80%.", "medium"],
  ["How many moles of solute are in 250 mL of a 0.40 mol L⁻¹ solution?", "0.10 mol", ["0.016 mol", "0.40 mol", "1.60 mol"], "n = MV = 0.40 × 0.250 = 0.10 mol.", "medium"],
  ["What volume of 2.0 mol L⁻¹ NaCl contains 0.50 mol NaCl?", "0.25 L", ["0.10 L", "1.0 L", "4.0 L"], "V = n/M = 0.50/2.0 = 0.25 L.", "medium"],
  ["In the Haber reaction, 2 mol nitrogen is combined with 3 mol hydrogen. Identify the reagent that runs out.", "H₂", ["N₂", "NH₃", "Neither"], "The equation N₂ + 3H₂ → 2NH₃ shows that 3 mol H₂ consumes only 1 mol N₂, leaving nitrogen unused.", "medium"],
  ["What maximum amount of NH₃ forms from 2 mol N₂ and 3 mol H₂?", "2 mol", ["1 mol", "3 mol", "4 mol"], "The limiting 3 mol H₂ produces 2 mol NH₃.", "medium"],
  ["In 2Al + 3Cl₂ → 2AlCl₃, 5.4 g Al reacts with 14.2 g Cl₂. Which is limiting? Use Al = 27.0 and Cl₂ = 71.0 g mol⁻¹.", "Cl₂", ["Al", "AlCl₃", "Neither"], "Both inputs are 0.20 mol, but 0.20 mol Al requires 0.30 mol Cl₂, so Cl₂ limits.", "hard"],
  ["For the same mixture, how many moles of AlCl₃ can form?", "0.133 mol", ["0.100 mol", "0.200 mol", "0.300 mol"], "From 3Cl₂ → 2AlCl₃, 0.20 mol Cl₂ gives 0.20 × 2/3 = 0.133 mol.", "hard"],
  ["What is the concentration after 100 mL of 1.0 mol L⁻¹ solution is diluted to 500 mL?", "0.20 mol L⁻¹", ["0.10 mol L⁻¹", "1.0 mol L⁻¹", "5.0 mol L⁻¹"], "Using M₁V₁ = M₂V₂ gives M₂ = 1.0 × 100/500 = 0.20 M.", "easy", G],
  ["How much 2.0 mol L⁻¹ HCl is needed to prepare 250 mL of 0.40 mol L⁻¹ HCl?", "50 mL", ["20 mL", "100 mL", "125 mL"], "V₁ = M₂V₂/M₁ = 0.40 × 250/2.0 = 50 mL.", "medium", G],
  ["What volume of 0.50 mol L⁻¹ NaOH neutralizes 25.0 mL of 0.20 mol L⁻¹ H₂SO₄?", "20.0 mL", ["10.0 mL", "25.0 mL", "40.0 mL"], "H₂SO₄ + 2NaOH: acid moles are 0.0050, requiring 0.0100 mol NaOH, or 0.0200 L.", "medium", G],
  ["When 10.0 g CaCO₃ reacts with excess acid, the theoretical CO₂ yield is 4.40 g. If 3.74 g is collected, what is the percent yield?", "85.0%", ["15.0%", "74.0%", "117.6%"], "Percent yield = 3.74/4.40 × 100 = 85.0%.", "hard", G],
  ["A 25.0 mL acid sample requires 30.0 mL of 0.100 mol L⁻¹ NaOH in a 1:1 reaction. What is the acid concentration?", "0.120 mol L⁻¹", ["0.075 mol L⁻¹", "0.100 mol L⁻¹", "0.300 mol L⁻¹"], "NaOH moles = 0.00300; dividing by 0.0250 L gives 0.120 M acid.", "hard", G],
]);

// 4. Ionic, covalent and metallic bonding (20)
addTopic("Ionic, Covalent and Metallic Bonding", "Period 6; CHM 101 Chemical Bonding slides; Chapter 7", [
  ["An ionic bond is primarily the electrostatic attraction between what?", "Oppositely charged ions", ["Two neutral noble gases", "Identical atomic nuclei", "Free neutrons and protons"], "Electron transfer produces cations and anions that attract electrostatically.", "easy"],
  ["A covalent bond forms when atoms do what?", "Share electron pairs", ["Share protons", "Exchange neutrons", "Lose all inner-shell electrons"], "Covalent bonding involves shared valence-electron pairs.", "easy"],
  ["Which type of bonding is commonly described as positive ions in a sea of delocalized electrons?", "Metallic bonding", ["Ionic bonding", "Hydrogen bonding", "Coordinate bonding"], "Delocalized valence electrons hold metal cations together.", "easy"],
  ["What happens to a neutral atom when it loses an electron?", "It becomes a cation", ["It becomes an anion", "Its atomic number increases", "It becomes an isotope"], "Losing negatively charged electrons leaves a net positive charge.", "easy"],
  ["What happens when a neutral nonmetal atom gains electrons?", "It forms an anion", ["It forms a cation", "It loses its nucleus", "Its proton number decreases"], "Electron gain gives the particle a net negative charge.", "easy"],
  ["What is bond energy?", "Energy required to break a specified bond", ["Mass lost during bond formation", "Number of bonds in one atom", "Charge carried by a molecule"], "Bond breaking requires energy; bond formation releases energy.", "easy"],
  ["Why does solid NaCl conduct electricity poorly while molten NaCl conducts?", "Its ions become mobile when molten", ["Electrons are created during melting", "NaCl becomes a metal", "Chloride ions disappear in the solid"], "In a solid lattice ions are fixed, whereas molten ions can carry charge.", "medium"],
  ["Which combination is most likely to form an ionic compound?", "A metal and a nonmetal", ["Two noble gases", "Two identical nonmetals only", "Two metal cations"], "Metals tend to lose electrons and nonmetals tend to gain them.", "medium"],
  ["A coordinate covalent bond differs from an ordinary covalent bond because what happens initially?", "One atom supplies both shared electrons", ["No electrons are shared", "Both atoms supply two protons", "The bond contains only one electron"], "After formation, the shared pair behaves like any other covalent bond pair.", "medium"],
  ["How many sigma and pi bonds are present in a carbon-carbon double bond?", "One sigma and one pi", ["Two sigma and no pi", "One sigma and two pi", "No sigma and two pi"], "A double bond consists of one σ bond plus one π bond.", "medium"],
  ["How many sigma and pi bonds occur in a carbon-carbon triple bond?", "One sigma and two pi", ["Three sigma and no pi", "Two sigma and one pi", "One sigma and one pi"], "A triple bond has one head-on σ bond and two side-on π bonds.", "medium"],
  ["For bonds between the same two atoms, which order of bond length is generally correct?", "Single > double > triple", ["Triple > double > single", "Double > single > triple", "All have identical lengths"], "Higher bond order concentrates more electron density between nuclei and shortens the bond.", "medium"],
  ["Why are ionic solids often brittle?", "Shifting layers can bring like charges together", ["Their ions have no charge", "They contain only flexible molecules", "Their melting points are always below room temperature"], "When lattice layers shift, like-charged ions repel and the crystal fractures.", "medium"],
  ["Which compound should have the greater lattice attraction: NaCl or MgO?", "MgO", ["NaCl", "They must be identical", "Neither forms a lattice"], "Mg²⁺ and O²⁻ have a larger charge product than Na⁺ and Cl⁻, strengthening attraction.", "hard"],
  ["Why is a C≡C bond generally stronger than a C=C bond?", "It has greater bond order and electron density between nuclei", ["It contains fewer shared electrons", "Its atoms carry no nuclei", "It is always ionic"], "Greater bond order normally gives a shorter, stronger bond for the same atom pair.", "hard"],
  ["How many valence electrons does an isolated oxygen atom have?", "6", ["2", "8", "16"], "Oxygen is in group 16 and therefore has six valence electrons.", "easy", G],
  ["What is the electron configuration of Na⁺?", "1s²2s²2p⁶", ["1s²2s²2p⁶3s¹", "1s²2s²2p⁵", "1s²2s²2p⁶3s²"], "Sodium loses its 3s electron to become isoelectronic with neon.", "medium", G],
  ["The H–Cl bond is best described as what?", "Polar covalent", ["Nonpolar covalent", "Purely metallic", "An ion-ion attraction in the gas molecule"], "The electrons are shared unequally because chlorine is more electronegative.", "medium", G],
  ["Which change should increase lattice energy magnitude most strongly?", "Increasing ionic charges while decreasing ionic radii", ["Decreasing charges while increasing radii", "Making both ions neutral", "Increasing only the number of neutrons"], "Coulombic attraction grows with charge product and decreases with separation.", "hard", G],
  ["Which order correctly gives decreasing ionic radius for the isoelectronic ions O²⁻, F⁻, Na⁺ and Mg²⁺?", "O²⁻ > F⁻ > Na⁺ > Mg²⁺", ["Mg²⁺ > Na⁺ > F⁻ > O²⁻", "F⁻ > O²⁻ > Mg²⁺ > Na⁺", "Na⁺ > Mg²⁺ > O²⁻ > F⁻"], "All four ions have ten electrons; increasing nuclear charge pulls that electron cloud closer, so radius decreases from O²⁻ to Mg²⁺.", "hard", G],
]);

// 5. Lewis structures, formal charge and resonance (20)
addTopic("Lewis Structures, Formal Charge and Resonance", "Period 6; Chapter 7 Chemical Bonding and Molecular Geometry", [
  ["What do dots in a Lewis symbol represent?", "Valence electrons", ["Neutrons", "Core protons", "Atomic mass units"], "Lewis symbols display an atom's valence electrons.", "easy"],
  ["A single line in a Lewis structure represents how many shared electrons?", "2", ["1", "4", "8"], "One covalent bond line represents one shared electron pair.", "easy"],
  ["How many electrons normally complete hydrogen's valence shell?", "2", ["4", "6", "8"], "Hydrogen follows the duet rule because its only shell contains the 1s orbital.", "easy"],
  ["What is a lone pair?", "A nonbonding pair of valence electrons", ["A pair of atomic nuclei", "Two electrons shared by three atoms", "A pair of protons in one bond"], "A lone pair belongs primarily to one atom and is not used in a bond.", "easy"],
  ["Which atom is usually placed at the centre of a Lewis structure?", "The least electronegative suitable atom", ["Hydrogen in every molecule", "The most electronegative terminal atom", "A noble gas regardless of formula"], "Except for special cases, the less electronegative atom is central and hydrogen is terminal.", "easy"],
  ["What is the octet rule?", "Main-group atoms tend toward eight valence electrons", ["Every molecule contains eight atoms", "Every bond contains eight electrons", "Atoms always form eight bonds"], "Many main-group atoms gain, lose or share electrons to attain a noble-gas-like octet.", "easy"],
  ["How many total valence electrons are used to draw CH₄?", "8", ["4", "10", "12"], "Carbon contributes four and four hydrogens contribute one each, totaling eight.", "medium"],
  ["How many lone pairs are on nitrogen in the usual Lewis structure of NH₃?", "1", ["0", "2", "3"], "Nitrogen forms three N–H bonds and retains one lone pair.", "medium"],
  ["What bonding pattern gives every atom an octet in CO₂?", "O=C=O", ["O–C–O with no lone pairs", "O≡C–O with identical zero charges", "C–O₂ as an ionic lattice"], "Two C=O double bonds give carbon and both oxygens complete octets with zero formal charge.", "medium"],
  ["Resonance structures differ in what way?", "Electron placement, not atom positions", ["The identities of their atoms", "The total number of electrons", "Their molecular formulas"], "Resonance forms keep the same atomic skeleton and redistribute electrons.", "medium"],
  ["Why are multiple resonance structures drawn for ozone?", "No single localized structure represents its equivalent bonds", ["Ozone continuously changes its number of atoms", "One oxygen atom has no electrons", "Ozone is an ionic metal"], "The actual electron distribution is a resonance hybrid with equivalent O–O bonding.", "medium"],
  ["Which formula defines formal charge?", "valence electrons − nonbonding electrons − half the bonding electrons", ["protons + neutrons − electrons", "bonding electrons − valence electrons", "atomic mass − atomic number"], "Formal charge assigns bonding electrons equally between bonded atoms.", "medium"],
  ["Which guideline usually identifies the preferred Lewis structure?", "Minimize formal-charge magnitudes and place negative charge on electronegative atoms", ["Maximize every formal charge", "Place positive charge on the most electronegative atom", "Ignore the total electron count"], "Small formal charges with chemically sensible placement usually give the best contributor.", "medium"],
  ["What is the average N–O bond order in nitrate, NO₃⁻?", "1⅓", ["1", "1½", "2"], "Three equivalent resonance positions share one double bond over three N–O bonds: (2+1+1)/3 = 4/3.", "hard"],
  ["What is the average O–O bond order in ozone?", "1½", ["1", "2", "3"], "Two equivalent bonds share one single and one double bond, giving (1+2)/2 = 1.5.", "hard"],
  ["Which molecule is a common incomplete-octet exception?", "BF₃", ["CH₄", "NH₃", "H₂O"], "Boron has only six electrons around it in the standard BF₃ Lewis structure.", "easy", G],
  ["Which species has an expanded valence shell on its central atom?", "PCl₅", ["CH₄", "NH₃", "BF₃"], "Phosphorus in period 3 can be surrounded by ten electrons in PCl₅.", "medium", G],
  ["Which molecule is an odd-electron species?", "NO", ["N₂", "CO₂", "CH₄"], "NO has 11 valence electrons and cannot pair all of them in a conventional octet structure.", "medium", G],
  ["In one valid nitrate resonance form, what formal charge is on the central nitrogen?", "+1", ["0", "−1", "+2"], "Nitrogen has four bonds, no lone pairs and formal charge 5 − 0 − 4 = +1.", "hard", G],
  ["For SO₄²⁻, what must the sum of all formal charges equal?", "−2", ["0", "+2", "−4"], "Formal charges over the complete Lewis structure must sum to the species' overall charge.", "hard", G],
]);

// 6. VSEPR, molecular geometry, polarity and hybridization (20)
addTopic("VSEPR, Molecular Geometry, Polarity and Hybridization", "Period 6; CHM 101 Chemical Bonding slides; Chapter 7", [
  ["According to VSEPR theory, electron domains arrange themselves to do what?", "Minimize repulsions", ["Maximize formal charge", "Increase atomic mass", "Eliminate all valence electrons"], "Electron domains adopt arrangements that keep them as far apart as possible.", "easy"],
  ["Carbon dioxide has two bonding domains around its central carbon. Which arrangement results?", "Linear", ["Bent", "Trigonal pyramidal", "Tetrahedral"], "Two bonding domains around carbon arrange 180° apart.", "easy"],
  ["Four C–H bonds surround carbon with no lone pairs in methane. Which structure describes it?", "Tetrahedral", ["Square planar", "Bent", "Trigonal planar"], "Four bonding domains and no lone pairs give tetrahedral geometry.", "easy"],
  ["Three B–F bonds and no central lone pair occur in BF₃. How are the atoms arranged?", "Trigonal planar", ["Trigonal pyramidal", "T-shaped", "Octahedral"], "Three bonding domains and no lone pairs lie in one plane at about 120°.", "easy"],
  ["Three N–H bonds and one lone pair surround nitrogen in ammonia. What molecular shape follows?", "Trigonal pyramidal", ["Trigonal planar", "Linear", "Square planar"], "NH₃ has three bonds and one lone pair around nitrogen.", "easy"],
  ["Two O–H bonds and two lone pairs surround oxygen. What shape does the water molecule adopt?", "Bent", ["Linear", "Tetrahedral", "Trigonal planar"], "Two O–H bonds and two lone pairs give a bent molecular shape.", "easy"],
  ["How many electron domains surround carbon in CH₄?", "4", ["2", "3", "5"], "Each C–H bond is one electron domain.", "medium"],
  ["Which repulsion is generally strongest?", "Lone pair–lone pair", ["Bond pair–bond pair", "A sigma bond–nucleus", "Two core shells"], "Lone pairs occupy more space and repel other electron domains most strongly.", "medium"],
  ["Why is the H–O–H bond angle smaller than the ideal tetrahedral angle?", "Lone pairs compress the bond angle", ["Hydrogen has d orbitals", "Oxygen has no valence electrons", "The molecule is ionic"], "The two lone pairs on oxygen exert stronger repulsion than bonding pairs.", "medium"],
  ["What is the electron-domain geometry around nitrogen in NH₃?", "Tetrahedral", ["Trigonal planar", "Linear", "Octahedral"], "Three bonding pairs plus one lone pair make four electron domains.", "medium"],
  ["Why is CO₂ nonpolar despite having polar C=O bonds?", "Its equal bond dipoles cancel in a linear geometry", ["Carbon and oxygen have equal electronegativity", "It has an overall ionic charge", "Its bonds contain no electrons"], "The two equal C=O dipoles point in opposite directions.", "medium"],
  ["Why is H₂O polar?", "Its bent geometry prevents bond-dipole cancellation", ["Its O–H bonds are nonpolar", "It has a perfectly symmetric linear shape", "It contains only ions"], "The polar O–H bonds form a bent arrangement with a nonzero resultant dipole.", "medium"],
  ["Which hybridization corresponds to four electron domains around a central atom?", "sp³", ["sp", "sp²", "dsp²"], "Four equivalent electron domains are described by sp³ hybrid orbitals.", "medium"],
  ["What are the molecular geometry and approximate bond angle of SO₂?", "Bent and about 120°", ["Linear and 180°", "Tetrahedral and 109.5°", "Square planar and 90°"], "Three electron domains give trigonal-planar electron geometry; one lone pair makes the molecule bent.", "hard"],
  ["Which set correctly matches electron domains to ideal geometry: 2, 3 and 4 domains?", "Linear, trigonal planar, tetrahedral", ["Bent, linear, square planar", "Tetrahedral, trigonal planar, linear", "Linear, tetrahedral, octahedral"], "VSEPR arrangements for 2, 3 and 4 domains are linear, trigonal planar and tetrahedral.", "hard"],
  ["What is the ideal bond angle in a tetrahedral arrangement?", "109.5°", ["90°", "120°", "180°"], "Four domains point toward the corners of a tetrahedron at about 109.5°.", "easy", G],
  ["Five chlorine atoms bond to phosphorus without a lone pair in PCl₅. Which geometry results?", "Trigonal bipyramidal", ["Square pyramidal", "Octahedral", "T-shaped"], "Five bonding domains around phosphorus give trigonal-bipyramidal geometry.", "medium", G],
  ["Six equivalent S–F bonds point away from sulfur in SF₆. Which spatial arrangement fits?", "Octahedral", ["Tetrahedral", "Square planar", "Trigonal bipyramidal"], "Six bonding domains with no lone pairs give octahedral geometry.", "medium", G],
  ["Which molecule is nonpolar because its four identical bond dipoles cancel tetrahedrally?", "CCl₄", ["CH₃Cl", "NH₃", "H₂O"], "The symmetric tetrahedral arrangement in CCl₄ cancels all C–Cl dipoles.", "hard", G],
  ["What are the hybridization and geometry of the central atom in BeCl₂(g)?", "sp and linear", ["sp² and bent", "sp³ and tetrahedral", "dsp² and square planar"], "Two electron domains correspond to sp hybridization and a 180° linear geometry.", "hard", G],
]);

// 7. Intermolecular forces and physical properties (20)
addTopic("Intermolecular Forces and Physical Properties", "Period 6; CHM 101 Chemical Bonding slides; Chapter 7", [
  ["Which intermolecular force acts between all atoms and molecules?", "London dispersion force", ["Hydrogen bonding only", "Ion-ion attraction only", "Metallic bonding"], "Temporary fluctuations in electron density create dispersion forces in every particle.", "easy"],
  ["Dipole-dipole attractions occur primarily between which particles?", "Polar molecules", ["Only isolated neutrons", "Nonpolar atoms only", "Metal cations in a lattice"], "Permanent molecular dipoles attract when polar molecules approach one another.", "easy"],
  ["Hydrogen bonding requires hydrogen to be directly bonded to which kind of atom?", "N, O or F", ["Any metal", "Only carbon", "Na, Mg or Al"], "Highly electronegative N, O and F create the strongly polar bonds needed for conventional hydrogen bonding.", "easy"],
  ["Which intermolecular attraction is especially important between water molecules?", "Hydrogen bonding", ["Metallic bonding", "Ion-ion bonding", "Covalent network bonding"], "The O–H bonds and oxygen lone pairs allow extensive hydrogen bonding.", "easy"],
  ["What generally happens to boiling point as intermolecular forces become stronger?", "It increases", ["It always becomes zero", "It decreases in every case", "It becomes unrelated to pressure"], "More energy is needed to separate molecules held by stronger attractions.", "easy"],
  ["Which property describes a liquid's resistance to flow?", "Viscosity", ["Volatility", "Compressibility", "Molarity"], "Viscosity measures resistance to flow.", "easy"],
  ["Why does H₂O have a much higher boiling point than H₂S?", "Water forms stronger hydrogen bonds", ["H₂O has more electrons", "H₂S is ionic", "Water molecules have no polarity"], "Hydrogen bonding between water molecules is substantially stronger than the intermolecular forces in H₂S.", "medium"],
  ["Which substance should have the higher boiling point: CH₄ or C₄H₁₀?", "C₄H₁₀", ["CH₄", "They must be identical", "Neither can boil"], "The larger, more polarizable electron cloud of C₄H₁₀ gives stronger dispersion forces.", "medium"],
  ["Which is the strongest attraction between Na⁺ ions and water molecules?", "Ion-dipole attraction", ["London force only", "Metallic bonding", "Covalent bonding between all particles"], "The ion interacts strongly with the partial charges of polar water molecules.", "medium"],
  ["What generally happens to vapour pressure when intermolecular forces become stronger at the same temperature?", "It decreases", ["It increases without limit", "It becomes exactly atmospheric", "It is unaffected"], "Fewer molecules escape into the vapour phase when attractions are stronger.", "medium"],
  ["Why do nonpolar I₂ molecules attract one another?", "Their electron clouds form instantaneous and induced dipoles", ["Each iodine is permanently ionic", "They share protons between molecules", "They form metallic bonds"], "Large polarizable electron clouds produce significant London dispersion attractions.", "medium"],
  ["Which liquid should have greater viscosity if molecular sizes are comparable?", "The liquid with stronger intermolecular attractions", ["The liquid with no particles", "The liquid with weaker attractions", "They must have equal viscosity"], "Stronger attractions hinder molecular motion and flow.", "medium"],
  ["Why does ice have a lower density than liquid water?", "Hydrogen bonds create an open solid lattice", ["Ice contains no molecules", "Water atoms lose all electrons on freezing", "Covalent bonds disappear in ice"], "The ordered hydrogen-bond network holds water molecules farther apart in ice.", "medium"],
  ["Arrange CH₄, NH₃ and H₂O in increasing boiling point.", "CH₄ < NH₃ < H₂O", ["H₂O < NH₃ < CH₄", "NH₃ < H₂O < CH₄", "CH₄ < H₂O < NH₃"], "CH₄ has dispersion forces only; NH₃ hydrogen-bonds, while water forms a stronger, more extensive network.", "hard"],
  ["Which should have the higher boiling point, pentane or neopentane, and why?", "Pentane, because its larger contact surface strengthens dispersion forces", ["Neopentane, because branching always strengthens dispersion", "They have identical boiling points because their formulas match", "Neopentane, because it is ionic"], "The less compact pentane molecule has greater surface contact and stronger dispersion attractions.", "hard"],
  ["What is surface tension?", "The tendency of a liquid surface to minimize its area", ["The pressure of an ideal gas", "The mass per mole of a liquid", "The charge on a solvent"], "Cohesive attractions make a liquid surface behave as though under tension.", "easy", G],
  ["Which molecule can hydrogen-bond with water as an acceptor but cannot donate a hydrogen bond?", "CH₃OCH₃", ["CH₃OH", "NH₃", "HF"], "Ether oxygen has lone pairs but the molecule has no H directly bonded to O, N or F.", "medium", G],
  ["Why is ethanol soluble in water?", "Its hydroxyl group hydrogen-bonds with water", ["It forms a metallic lattice", "It contains no polar bonds", "It ionizes completely into C²⁺ and H⁻"], "The polar O–H group interacts favourably with water through hydrogen bonding.", "medium", G],
  ["At the same temperature, which liquid is expected to evaporate faster: one with vapour pressure 80 kPa or 20 kPa?", "The 80 kPa liquid", ["The 20 kPa liquid", "Both must evaporate equally", "Neither can evaporate below boiling"], "Higher vapour pressure indicates a greater tendency for molecules to escape the liquid.", "hard", G],
  ["Why does increasing molar mass down the noble gases generally raise boiling point?", "Polarizability and dispersion forces increase", ["Permanent ionic charges appear", "Hydrogen bonds become dominant", "Atomic nuclei become less positive"], "Larger electron clouds are more easily distorted and produce stronger instantaneous dipoles.", "hard", G],
]);

// 8. Kinetic theory, states of matter and phase changes (20)
addTopic("Kinetic Theory, States of Matter and Phase Changes", "KINETIC THEORY OF MATTER; CHM 101 Chemical Bonding slides", [
  ["According to kinetic theory, particles of matter are generally in what state?", "Constant motion", ["Permanent rest", "Complete electrical neutrality only", "A fixed linear arrangement in every phase"], "The kinetic model treats particles as continually moving, although motion differs by phase.", "easy"],
  ["How do particles in a solid mainly move?", "They vibrate about fixed positions", ["They travel freely through the container", "They remain perfectly motionless", "They expand without limit"], "Strong attractions hold solid particles in place while allowing vibration.", "easy"],
  ["Which state has a fixed volume but takes the shape of its container?", "Liquid", ["Solid", "Gas", "Vacuum"], "Liquid particles remain close but can flow past one another.", "easy"],
  ["Why are gases easily compressed?", "There is much empty space between their particles", ["Their particles have no mass", "Their covalent bonds break immediately", "Their temperatures are always zero"], "Widely separated gas particles can be pushed closer together.", "easy"],
  ["What causes gas pressure on a container wall?", "Particle collisions with the wall", ["The colour of the gas", "Only gravitational attraction", "Chemical bonds to the container"], "Momentum transfer during collisions produces force per unit area.", "easy"],
  ["Average kinetic energy of gas particles is directly proportional to what?", "Absolute temperature", ["Celsius temperature only", "Molar mass only", "Container colour"], "Mean translational kinetic energy is proportional to temperature in kelvin.", "easy"],
  ["What happens to particle motion when temperature increases?", "Average particle speed increases", ["All particles stop", "Particle mass becomes zero", "Interparticle space must vanish"], "Heating raises average kinetic energy and therefore characteristic particle speeds.", "medium"],
  ["Which change of state is called sublimation?", "Solid directly to gas", ["Gas directly to solid", "Liquid to solid", "Gas to liquid"], "Sublimation bypasses the liquid phase.", "medium"],
  ["Which change of state is exothermic?", "Condensation", ["Vaporization", "Melting", "Sublimation"], "Gas particles release energy as attractions form during condensation.", "medium"],
  ["During boiling at constant pressure, why can temperature remain constant while heat is supplied?", "The energy overcomes intermolecular attractions", ["No energy enters the sample", "Particle motion stops completely", "The thermometer loses all mass"], "Latent heat increases potential energy during the phase change rather than average kinetic energy.", "medium"],
  ["Why do liquids have much greater densities than gases?", "Their particles are much closer together", ["Liquid particles always have larger nuclei", "Gases contain only electrons", "Liquids have no intermolecular spaces"], "Attractions keep liquid particles close, whereas gas particles are widely separated.", "medium"],
  ["Which order gives increasing ease of compression?", "Solid < liquid < gas", ["Gas < liquid < solid", "Liquid < gas < solid", "Solid < gas < liquid"], "Available empty space is smallest in solids and greatest in gases.", "medium"],
  ["What is diffusion?", "Net spreading of particles from higher to lower concentration", ["Freezing at constant temperature", "Separation caused only by gravity", "Conversion of mass into charge"], "Random particle motion produces net mixing down a concentration gradient.", "medium"],
  ["A heating curve has a horizontal segment at the melting point. What changes during this segment?", "Potential energy increases while average kinetic energy stays constant", ["Both kinetic and potential energy become zero", "Average kinetic energy increases while phase is unchanged", "Particle number doubles"], "Temperature tracks average kinetic energy, which is constant during the phase transition.", "hard"],
  ["Why can evaporation cool a liquid?", "Higher-energy molecules preferentially escape", ["Evaporation creates cold particles", "All low-energy molecules leave first", "The liquid gains mass"], "Removing above-average-energy molecules lowers the average kinetic energy of those remaining.", "hard"],
  ["Which state of matter consists of ions and free electrons?", "Plasma", ["Ideal solid", "Supercooled liquid", "Vacuum"], "Plasma is an ionized state containing charged particles.", "easy", G],
  ["What is deposition?", "Gas changing directly to solid", ["Solid changing directly to gas", "Liquid changing to gas", "Solid changing to liquid"], "Deposition is the reverse of sublimation.", "medium", G],
  ["At dynamic liquid-vapour equilibrium, what is true?", "Evaporation and condensation rates are equal", ["No molecules cross the interface", "All liquid has evaporated", "Vapour pressure is zero"], "Molecules continue to exchange phases, but equal rates keep macroscopic amounts constant.", "medium", G],
  ["How much heat melts 20 g of ice at 0 °C if the enthalpy of fusion is 334 J g⁻¹?", "6680 J", ["16.7 J", "334 J", "33,400 J"], "q = mΔHfus = 20 × 334 = 6680 J.", "hard", G],
  ["A substance is heated through a single phase with constant power. What does a steeper temperature-time slope indicate, for equal masses?", "A smaller specific heat capacity", ["A larger enthalpy of fusion", "A larger specific heat capacity", "A lower heating power"], "With q = mcΔT, the same energy rate produces faster temperature rise when c is smaller.", "hard", G],
]);

// 9. Gas laws and ideal-gas behaviour (20)
addTopic("Gas Laws and Ideal-Gas Behaviour", "KINETIC THEORY OF MATTER", [
  ["Boyle's law relates pressure inversely to what at constant temperature?", "Volume", ["Amount only", "Molar mass", "Density of the container"], "For a fixed gas at constant temperature, PV is constant.", "easy"],
  ["Charles's law states that gas volume is directly proportional to what at constant pressure?", "Absolute temperature", ["Pressure", "Molar mass", "Density"], "Volume is proportional to temperature measured in kelvin.", "easy"],
  ["Avogadro's law states that equal gas volumes at the same temperature and pressure contain equal what?", "Numbers of molecules", ["Masses", "Densities", "Atomic numbers"], "At fixed T and P, volume is proportional to amount in moles.", "easy"],
  ["Which equation is the ideal-gas equation?", "PV = nRT", ["P = nR/V T⁻¹", "V = PRnT", "PT = nR/V"], "The ideal-gas equation connects pressure, volume, amount and absolute temperature.", "easy"],
  ["What temperature scale must normally be used in gas-law calculations?", "Kelvin", ["Celsius", "Fahrenheit", "Any scale without conversion"], "Gas-law proportionalities require absolute temperature.", "easy"],
  ["Dalton's law concerns what quantity in a gas mixture?", "Partial pressures", ["Lattice energies", "Bond orders", "Melting enthalpies"], "Total pressure equals the sum of component partial pressures for an ideal mixture.", "easy"],
  ["A gas occupies 2.0 L at 100 kPa. What volume will it occupy at 200 kPa at constant temperature?", "1.0 L", ["0.50 L", "2.0 L", "4.0 L"], "P₁V₁ = P₂V₂, so V₂ = 100 × 2.0/200 = 1.0 L.", "medium"],
  ["A gas occupies 300 mL at 300 K. What volume will it occupy at 400 K at constant pressure?", "400 mL", ["225 mL", "300 mL", "700 mL"], "V₂ = V₁T₂/T₁ = 300 × 400/300 = 400 mL.", "medium"],
  ["What pressure is exerted by 1.0 mol ideal gas in 24.6 L at 300 K using R = 8.314 kPa L mol⁻¹ K⁻¹?", "About 101 kPa", ["10.1 kPa", "24.6 kPa", "831 kPa"], "P = nRT/V = 1 × 8.314 × 300/24.6 ≈ 101 kPa.", "medium"],
  ["A mixture contains gases at partial pressures 20, 35 and 45 kPa. What is the total pressure?", "100 kPa", ["45 kPa", "65 kPa", "1575 kPa"], "Dalton's law gives 20 + 35 + 45 = 100 kPa.", "medium"],
  ["According to Graham's law, which gas effuses faster?", "The gas with lower molar mass", ["The gas with higher molar mass", "Both always effuse equally", "Only a polar gas"], "Effusion rate is inversely proportional to the square root of molar mass.", "medium"],
  ["Why do real gases deviate most from ideal behaviour at high pressure?", "Molecular volume and attractions become significant", ["Molecules lose all kinetic energy", "The gas has no particles", "Pressure stops being measurable"], "Crowding makes finite molecular size and intermolecular interactions important.", "medium"],
  ["Under which conditions does a real gas behave most ideally?", "Low pressure and high temperature", ["High pressure and low temperature", "At the condensation point", "Only at absolute zero"], "Particles are far apart and kinetic energy dominates attractions at low P and high T.", "medium"],
  ["Hydrogen effuses how many times faster than oxygen at the same temperature, using molar masses 2 and 32?", "4 times", ["2 times", "8 times", "16 times"], "rH₂/rO₂ = √(32/2) = √16 = 4.", "hard"],
  ["A gas occupies 5.0 L at 100 kPa and 300 K. What volume does it occupy at 150 kPa and 450 K?", "5.0 L", ["2.22 L", "3.33 L", "7.50 L"], "V₂ = V₁(P₁/P₂)(T₂/T₁) = 5(100/150)(450/300) = 5.0 L.", "hard"],
  ["At standard conditions near 273 K and 1 atm, one mole of an ideal gas occupies approximately what volume?", "22.4 L", ["1.00 L", "8.31 L", "44.8 L"], "The commonly used molar volume at 0 °C and 1 atm is about 22.4 L/mol.", "easy", G],
  ["What is the mole fraction of a gas with partial pressure 30 kPa in a mixture at 120 kPa?", "0.25", ["0.30", "0.40", "4.0"], "For an ideal mixture, mole fraction equals partial pressure divided by total pressure: 30/120.", "medium", G],
  ["What is the density of CO₂ at 300 K and 100 kPa? Use M = 44.0 g mol⁻¹ and R = 8.314 kPa L mol⁻¹ K⁻¹.", "About 1.76 g L⁻¹", ["0.57 g L⁻¹", "4.40 g L⁻¹", "17.6 g L⁻¹"], "Density d = PM/RT = 100 × 44/(8.314 × 300) ≈ 1.76 g/L.", "medium", G],
  ["A 2.0 L vessel contains 0.10 mol gas at 27 °C. What pressure is predicted using R = 8.314 kPa L mol⁻¹ K⁻¹?", "About 125 kPa", ["12.5 kPa", "83.1 kPa", "249 kPa"], "Convert 27 °C to 300 K, then P = 0.10 × 8.314 × 300/2.0 ≈ 125 kPa.", "hard", G],
  ["A gas takes 100 s to effuse. Under identical conditions another gas with four times the molar mass takes approximately how long?", "200 s", ["25 s", "50 s", "400 s"], "Rate falls by √4 = 2; time for the same amount therefore doubles.", "hard", G],
]);

// 10. Thermochemistry and calorimetry (20)
addTopic("Thermochemistry and Calorimetry", "THERMOCHEMISTRY; CHM 101 THERMOCHEMISTRY", [
  ["What does thermochemistry study?", "Heat changes accompanying chemical and physical processes", ["Only atomic masses", "The naming of compounds only", "Motion without energy changes"], "Thermochemistry focuses on energy transferred as heat during chemical and physical changes.", "easy"],
  ["What is the system in a thermochemical investigation?", "The part of the universe being studied", ["Everything outside the experiment", "Only the thermometer", "The laboratory building in every case"], "The system is the selected reaction or process; everything else is the surroundings.", "easy"],
  ["What sign does ΔH have for an exothermic process?", "Negative", ["Positive", "Always zero", "Undefined"], "An exothermic system releases heat and loses enthalpy, so ΔH < 0.", "easy"],
  ["What sign does ΔH have for an endothermic process?", "Positive", ["Negative", "Always zero", "It must equal pressure"], "An endothermic system absorbs heat, so its enthalpy increases.", "easy"],
  ["Which equation calculates heat absorbed by a substance when no phase change occurs?", "q = mcΔT", ["q = m/cΔT", "q = PV", "q = nRT²"], "Heat equals mass times specific heat capacity times temperature change.", "easy"],
  ["What is specific heat capacity?", "Heat needed to raise unit mass by one degree", ["Heat released by one mole during combustion", "Mass per unit volume", "Pressure per unit temperature"], "Specific heat capacity relates heat input to mass and temperature rise.", "easy"],
  ["If a reaction mixture warms its surroundings, the reaction is most likely what?", "Exothermic", ["Endothermic", "At absolute zero", "Necessarily nonspontaneous"], "Heat released by the system raises the surroundings' temperature.", "medium"],
  ["How much heat raises 50.0 g of water by 10.0 °C? Use c = 4.18 J g⁻¹ °C⁻¹.", "2090 J", ["20.9 J", "418 J", "4180 J"], "q = 50.0 × 4.18 × 10.0 = 2090 J.", "medium"],
  ["A 100 g metal absorbs 900 J and warms by 20 °C. What is its specific heat capacity?", "0.45 J g⁻¹ °C⁻¹", ["0.022 J g⁻¹ °C⁻¹", "4.5 J g⁻¹ °C⁻¹", "180 J g⁻¹ °C⁻¹"], "c = q/(mΔT) = 900/(100 × 20) = 0.45 J g⁻¹ °C⁻¹.", "medium"],
  ["In an insulated calorimeter, heat lost by a hot object is related to heat gained by the cooler water how?", "They are equal in magnitude and opposite in sign", ["Both are positive and unequal", "Both are always zero", "The object's heat is twice the water's"], "Energy conservation gives qhot + qcold = 0 when other heat exchanges are negligible.", "medium"],
  ["A process absorbs 25 kJ of heat at constant pressure. What is ΔH?", "+25 kJ", ["−25 kJ", "0 kJ", "+50 kJ"], "At constant pressure, absorbed heat corresponds to a positive enthalpy change.", "medium"],
  ["When an exothermic thermochemical equation is reversed, what happens to ΔH?", "Its sign changes", ["Its magnitude doubles", "It becomes zero", "Nothing changes"], "Reversing the process reverses the direction of energy transfer.", "medium"],
  ["When every coefficient in a thermochemical equation is doubled, what happens to ΔH?", "It doubles", ["It halves", "Only its sign changes", "It remains unchanged"], "Enthalpy is extensive and scales with reaction amount.", "medium"],
  ["A 50.0 g metal at 100 °C is placed in 100 g water at 20 °C. Final temperature is 24 °C. Using cwater = 4.18 J g⁻¹ °C⁻¹, what is the metal's specific heat, neglecting calorimeter heat?", "About 0.44 J g⁻¹ °C⁻¹", ["0.11 J g⁻¹ °C⁻¹", "1.67 J g⁻¹ °C⁻¹", "4.18 J g⁻¹ °C⁻¹"], "Water gains 1672 J; metal cools 76 °C, so c = 1672/(50 × 76) ≈ 0.44.", "hard"],
  ["Burning 0.50 g of a fuel warms 200 g water by 12.0 °C. Using c = 4.18 J g⁻¹ °C⁻¹ and ignoring losses, what heat is released per gram of fuel?", "About 20.1 kJ g⁻¹", ["5.02 kJ g⁻¹", "10.0 kJ g⁻¹", "40.1 kJ g⁻¹"], "Water gains 200 × 4.18 × 12 = 10.032 kJ; divide by 0.50 g to obtain 20.1 kJ/g released.", "hard"],
  ["Which device measures heat released by combustion at constant volume?", "Bomb calorimeter", ["Burette", "Mass spectrometer", "Volumetric flask"], "A bomb calorimeter contains the combustion reaction in a rigid sealed vessel.", "easy", G],
  ["A calorimeter has heat capacity 500 J °C⁻¹ and its temperature rises 3.0 °C. How much heat does it absorb?", "1500 J", ["167 J", "500 J", "4500 J"], "qcal = CcalΔT = 500 × 3.0 = 1500 J.", "medium", G],
  ["A reaction releases 60 kJ when 2.0 mol reacts. What is the molar enthalpy change?", "−30 kJ mol⁻¹", ["+30 kJ mol⁻¹", "−60 kJ mol⁻¹", "−120 kJ mol⁻¹"], "Divide −60 kJ by 2.0 mol to get −30 kJ/mol.", "medium", G],
  ["A 100 g solution with c = 4.0 J g⁻¹ °C⁻¹ warms by 5.0 °C during reaction. What is qreaction if heat loss is negligible?", "−2.0 kJ", ["+2.0 kJ", "−0.50 kJ", "+20 kJ"], "The solution absorbs +2000 J, so the reaction releases −2000 J.", "hard", G],
  ["One mole of ice at 0 °C melts with ΔHfus = 6.01 kJ mol⁻¹ and then warms as liquid by 10 °C. Using 18 g mol⁻¹ and c = 4.18 J g⁻¹ °C⁻¹, what total heat is required?", "About 6.76 kJ", ["0.752 kJ", "6.01 kJ", "13.5 kJ"], "Heating liquid needs 18 × 4.18 × 10 = 0.752 kJ; total = 6.01 + 0.752 = 6.76 kJ.", "hard", G],
]);

// 11. Hess's law, formation enthalpy and bond energies (20)
addTopic("Hess's Law, Formation Enthalpy and Bond Energies", "THERMOCHEMISTRY; CHM 101 THERMOCHEMISTRY; Chapter 7", [
  ["What does Hess's law state about the enthalpy change of a reaction?", "It depends only on initial and final states", ["It depends only on reaction speed", "It is always positive", "It changes with the chosen pathway"], "Enthalpy is a state function, so path does not affect the overall change.", "easy"],
  ["What is the standard enthalpy of formation of an element in its standard state?", "Zero", ["One kJ mol⁻¹", "Its atomic number", "Always negative"], "The reference enthalpy of formation for a pure element in its standard state is defined as zero.", "easy"],
  ["Is bond breaking endothermic or exothermic?", "Endothermic", ["Exothermic", "Always thermally neutral", "Neither, because bonds have no energy"], "Energy must be supplied to separate bonded atoms.", "easy"],
  ["Is bond formation generally endothermic or exothermic?", "Exothermic", ["Endothermic", "Always zero", "Unrelated to energy"], "Energy is released when atoms form a more stable bonded arrangement.", "easy"],
  ["Which expression uses formation enthalpies to calculate reaction enthalpy?", "ΣΔHf(products) − ΣΔHf(reactants)", ["ΣΔHf(reactants) − ΣΔHf(products)", "Σ products + Σ reactants without coefficients", "ΔHf divided by temperature"], "Stoichiometric coefficients multiply each formation enthalpy before products minus reactants is taken.", "easy"],
  ["What is an average bond enthalpy?", "Average energy required to break one mole of a bond in gaseous species", ["Exact lattice energy of every solid", "Heat needed to melt one gram", "Charge on a covalent bond"], "Bond enthalpies are averaged across many gaseous molecular environments.", "easy"],
  ["If equations are added to produce a target equation, what happens to their enthalpy changes?", "They are added with the same algebraic operations", ["They are multiplied together", "They are discarded", "Only the largest is retained"], "Hess's law treats thermochemical equations algebraically.", "medium"],
  ["Carbon dioxide formation releases 394 kJ mol⁻¹. What enthalpy applies when one mole CO₂ decomposes back to C and O₂?", "+394 kJ", ["−394 kJ", "+197 kJ", "0 kJ"], "Reversing C + O₂ → CO₂ reverses the sign of ΔH.", "medium"],
  ["Formation of one mole liquid water from H₂ and ½O₂ has ΔH = −286 kJ. What accompanies production of two moles?", "−572 kJ", ["−286 kJ", "+286 kJ", "+572 kJ"], "Doubling the thermochemical equation doubles the enthalpy change.", "medium"],
  ["Using ΔHf° CO₂ = −394 and H₂O(l) = −286 kJ mol⁻¹, what is ΔH° for CH₄ + 2O₂ → CO₂ + 2H₂O if ΔHf° CH₄ = −75 kJ mol⁻¹?", "−891 kJ mol⁻¹", ["−605 kJ mol⁻¹", "−319 kJ mol⁻¹", "+891 kJ mol⁻¹"], "[−394 + 2(−286)] − [−75 + 0] = −966 + 75 = −891 kJ/mol.", "medium"],
  ["Using bond energies, how is ΔHreaction estimated?", "Energy to break bonds minus energy released forming bonds", ["Formed bonds minus broken bonds", "Sum of atomic masses", "Products divided by reactants"], "Breaking bonds requires energy; forming bonds releases it.", "medium"],
  ["If breaking reactant bonds requires 800 kJ and forming product bonds releases 950 kJ, what is estimated ΔH?", "−150 kJ", ["+150 kJ", "−1750 kJ", "+1750 kJ"], "ΔH ≈ 800 − 950 = −150 kJ.", "medium"],
  ["Why can an enthalpy calculated from average bond energies differ from an experimental value?", "Bond energies vary with molecular environment", ["Energy is not conserved", "All bonds have zero energy", "Experiments cannot measure heat"], "Tabulated values are averages and do not capture every molecule's exact bonding environment.", "medium"],
  ["Combining carbon-monoxide formation (−111 kJ) with its combustion to CO₂ (−283 kJ) gives what enthalpy for C + O₂ → CO₂?", "−394 kJ", ["−172 kJ", "+172 kJ", "+394 kJ"], "Adding the two equations cancels CO and gives −111 + (−283) = −394 kJ.", "hard"],
  ["Estimate ΔH for H₂ + Cl₂ → 2HCl using bond energies H–H = 436, Cl–Cl = 243 and H–Cl = 431 kJ mol⁻¹.", "−183 kJ mol⁻¹", ["+183 kJ mol⁻¹", "−614 kJ mol⁻¹", "+1110 kJ mol⁻¹"], "Bonds broken require 436 + 243 = 679 kJ; two H–Cl bonds release 862 kJ, so ΔH = −183.", "hard"],
  ["What is lattice energy concerned with?", "Energy change associated with separating or forming an ionic lattice", ["Rotation of a molecule", "Only melting a covalent liquid", "Energy of an isolated neutron"], "Lattice-energy conventions describe the large electrostatic energy of ionic-crystal formation or separation.", "easy", G],
  ["Why must the sign convention be stated when quoting lattice energy?", "Some definitions use lattice formation and others lattice dissociation", ["Ions have no charges", "Temperature has no scale", "The value is always zero"], "Formation and dissociation processes have equal magnitudes but opposite signs.", "medium", G],
  ["Which cycle relates lattice energy to formation, atomization, ionization and electron-affinity steps?", "Born–Haber cycle", ["Carnot cycle", "Krebs cycle", "Calvin cycle"], "A Born–Haber cycle applies Hess's law to ionic-solid formation.", "medium", G],
  ["A two-step path changes A to B at +50 kJ and B to C at −80 kJ. What energy change describes the reverse path from C to A?", "+30 kJ", ["−30 kJ", "+130 kJ", "−130 kJ"], "A → C is −30 kJ; reversing it gives C → A = +30 kJ.", "hard", G],
  ["For 2H₂ + O₂ → 2H₂O(g), use H–H = 436, O=O = 498 and O–H = 463 kJ mol⁻¹. What is estimated ΔH?", "−482 kJ", ["−241 kJ", "+482 kJ", "+1852 kJ"], "Break 2(436)+498 = 1370 kJ; form 4(463)=1852 kJ; ΔH = 1370−1852 = −482 kJ.", "hard", G],
]);

// 12. Redox reactions and electrochemistry (20)
addTopic("Redox Reactions and Electrochemistry", "Electrochemistry new; Unit 5a reaction classification", [
  ["What does oxidation mean in terms of electrons?", "Loss of electrons", ["Gain of electrons", "Sharing of neutrons", "Loss of protons only"], "The mnemonic OIL RIG begins with Oxidation Is Loss.", "easy"],
  ["What does reduction mean in terms of electrons?", "Gain of electrons", ["Loss of electrons", "Gain of neutrons", "Increase in mass only"], "Reduction is electron gain.", "easy"],
  ["What happens to oxidation number during oxidation?", "It increases", ["It decreases", "It must remain zero", "It becomes undefined"], "Electron loss makes oxidation state more positive or less negative.", "easy"],
  ["Where does oxidation occur in an electrochemical cell?", "At the anode", ["At the cathode", "Only in the salt bridge", "At both electrodes with no reduction"], "AnOx: oxidation always occurs at the anode.", "easy"],
  ["Where does reduction occur in an electrochemical cell?", "At the cathode", ["At the anode", "Only in the wire", "In the solvent only"], "RedCat: reduction always occurs at the cathode.", "easy"],
  ["What is the purpose of a salt bridge in a galvanic cell?", "Maintain electrical neutrality by ion migration", ["Supply electrons to both electrodes", "Stop all ion movement", "Increase electrode mass equally"], "The salt bridge completes the circuit and prevents charge buildup in half-cells.", "easy"],
  ["In a galvanic cell, chemical energy is converted into what?", "Electrical energy", ["Nuclear energy", "Mass only", "Sound energy only"], "A spontaneous redox reaction drives electron flow through an external circuit.", "medium"],
  ["In an electrolytic cell, electrical energy drives what kind of reaction?", "A nonspontaneous chemical reaction", ["A spontaneous nuclear reaction", "Only a phase change", "A reaction requiring no ions"], "An external power source forces a thermodynamically unfavourable redox process.", "medium"],
  ["In the Zn/Cu galvanic cell, in which direction do electrons flow externally?", "From Zn anode to Cu cathode", ["From Cu cathode to Zn anode", "Through the salt bridge only", "From both electrodes into solution"], "Zinc is oxidized and releases electrons that travel to the copper reduction electrode.", "medium"],
  ["What is the oxidation number of sulfur in SO₄²⁻?", "+6", ["−2", "+4", "+8"], "Let sulfur be x: x + 4(−2) = −2, so x = +6.", "medium"],
  ["Which species is oxidized in Zn + Cu²⁺ → Zn²⁺ + Cu?", "Zn", ["Cu²⁺", "Zn²⁺", "Cu"], "Zinc changes from 0 to +2 and loses two electrons.", "medium"],
  ["Which species acts as the oxidizing agent in Zn + Cu²⁺ → Zn²⁺ + Cu?", "Cu²⁺", ["Zn", "Zn²⁺", "Cu"], "Cu²⁺ accepts electrons and is reduced, so it oxidizes zinc.", "medium"],
  ["What is the standard cell potential formula using reduction potentials?", "E°cell = E°cathode − E°anode", ["E°cell = E°anode − E°cathode", "E°cell = E°cathode × E°anode", "E°cell = 0 for every cell"], "Subtract the anode reduction potential from the cathode reduction potential.", "medium"],
  ["Given E°(Cu²⁺/Cu) = +0.34 V and E°(Zn²⁺/Zn) = −0.76 V, what is E°cell for a Zn/Cu galvanic cell?", "+1.10 V", ["−1.10 V", "+0.42 V", "−0.42 V"], "E°cell = 0.34 − (−0.76) = +1.10 V.", "hard"],
  ["Balance MnO₄⁻ + Fe²⁺ + H⁺ → Mn²⁺ + Fe³⁺ + H₂O in acid. What is the coefficient of Fe²⁺?", "5", ["1", "3", "8"], "The balanced ionic equation is MnO₄⁻ + 5Fe²⁺ + 8H⁺ → Mn²⁺ + 5Fe³⁺ + 4H₂O.", "hard"],
  ["What is the oxidation number of an element in its uncombined standard form?", "0", ["+1", "−1", "Equal to its group number in every case"], "Atoms in an elemental substance such as O₂, Zn or S₈ have oxidation number zero.", "easy", G],
  ["How many moles of electrons are transferred when 1 mol Al becomes Al³⁺?", "3 mol", ["1 mol", "2 mol", "6 mol"], "Each Al atom loses three electrons: Al → Al³⁺ + 3e⁻.", "medium", G],
  ["Which electrode is positive in a galvanic cell?", "Cathode", ["Anode", "Salt bridge", "Both electrodes are always negative"], "The spontaneous reaction sends electrons away from the negative anode toward the positive cathode.", "medium", G],
  ["How much charge passes when a current of 2.0 A flows for 30 minutes?", "3600 C", ["60 C", "900 C", "7200 C"], "Q = It = 2.0 × (30 × 60) = 3600 C.", "hard", G],
  ["How many moles of Cu are deposited by 193,000 C in Cu²⁺ + 2e⁻ → Cu, using F = 96,500 C mol⁻¹?", "1.00 mol", ["0.50 mol", "2.00 mol", "4.00 mol"], "193,000 C is 2.00 mol electrons, and two electron moles deposit one mole Cu.", "hard", G],
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
    id: deterministicUuid(`chm101-question-${index + 1}-${question.prompt}`),
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
      reviewedFromLocalFiles: question.sourceKind === M,
    },
    generationMeta: {
      import: "codex_chm101_240_v1",
      sourceReference: question.sourceLabel,
      calculationAndConceptCheckCompleted: true,
      humanVerificationRequired: true,
    },
    options: question.options.map((text, optionIndex) => ({
      id: deterministicUuid(`chm101-option-${index + 1}-${optionIndex}-${text}`),
      text,
      isCorrect: optionIndex === question.answerIndex,
      position: optionIndex,
    })),
  }));
}

function renderSql(rows) {
  const payload = JSON.stringify(rows);
  if (payload.includes("$chm101_questions$")) throw new Error("Unexpected SQL dollar tag in generated content.");
  return `-- CHM 101 Exam Sprint: import 240 curated MCQs into an empty private bank
-- Sources: supplied CHM 101 files plus clearly labelled General CHM 101 enrichment
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
  WHERE upper(regexp_replace(coalesce(course_code, ''), '[^A-Za-z0-9]', '', 'g')) = 'CHM101'
    AND delivery_mode = 'mock_exam'
    AND exam_campaign_key = 'supplementary-2026';

  IF v_set_count = 0 THEN
    INSERT INTO public.study_quiz_sets
      (title, description, course_code, level, semester, difficulty, time_limit_minutes,
       questions_count, published, visibility, source, delivery_mode, exam_campaign_key,
       access_tier, exam_question_count, diagnostic_question_count, diagnostic_time_limit_minutes)
    VALUES
      ('CHM 101 Exam Sprint Mock',
       'Private CHM 101 bank covering supplied General Chemistry I materials and broader CHM 101 foundations.',
       'CHM 101', '100', 'first', 'hard', 40,
       0, false, 'private', 'exam_sprint', 'mock_exam', 'supplementary-2026',
       'plus_monthly', 40, 10, 10)
    RETURNING id INTO v_set_id;
  ELSIF v_set_count = 1 THEN
    SELECT id INTO v_set_id
    FROM public.study_quiz_sets
    WHERE upper(regexp_replace(coalesce(course_code, ''), '[^A-Za-z0-9]', '', 'g')) = 'CHM101'
      AND delivery_mode = 'mock_exam'
      AND exam_campaign_key = 'supplementary-2026'
    LIMIT 1;
  ELSE
    RAISE EXCEPTION 'More than one CHM 101 Exam Sprint bank exists. Keep one target bank before importing.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.study_quiz_questions
    WHERE coalesce(set_id, quiz_set_id) = v_set_id
  ) THEN
    RAISE EXCEPTION 'The CHM 101 target bank already contains questions. Import stopped to prevent duplicates.';
  END IF;

  FOR v_question IN
    SELECT value FROM jsonb_array_elements($chm101_questions$${payload}$chm101_questions$::jsonb)
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
  SET questions_count = 240,
      exam_question_count = 40,
      time_limit_minutes = 40,
      published = false,
      visibility = 'private',
      updated_at = now()
  WHERE id = v_set_id;
END
$import$;

COMMIT;

-- Expected: 240 questions, 960 options, 240 correct options, 0 verified before admin review.
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
WHERE upper(regexp_replace(coalesce(s.course_code, ''), '[^A-Za-z0-9]', '', 'g')) = 'CHM101'
  AND s.delivery_mode = 'mock_exam'
  AND s.exam_campaign_key = 'supplementary-2026'
GROUP BY s.id, s.title;
`;
}

function renderMarkdown() {
  const lines = [
    "# CHM 101 — 240-question Exam Sprint bank",
    "",
    "Sources: supplied CHM 101 PDFs, DOCX and PPTX files, with clearly labelled General CHM 101 enrichment.",
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
  const sourceKind = { supplied_material: 0, general_chm101: 0 };
  const topicCounts = new Map();
  const answerPositions = [0, 0, 0, 0];

  if (rows.length !== 240) errors.push(`Expected 240 questions; found ${rows.length}.`);
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

  if (difficulty.easy !== 84 || difficulty.medium !== 108 || difficulty.hard !== 48) {
    errors.push(`Difficulty balance is ${JSON.stringify(difficulty)}, expected 84/108/48.`);
  }
  if (sourceKind.supplied_material !== 180 || sourceKind.general_chm101 !== 60) {
    errors.push(`Source balance is ${JSON.stringify(sourceKind)}, expected 180/60.`);
  }
  if (topicCounts.size !== 12 || [...topicCounts.values()].some((count) => count !== 20)) {
    errors.push(`Expected 12 topics with 20 questions each; got ${JSON.stringify(Object.fromEntries(topicCounts))}.`);
  }
  if (answerPositions.some((count) => count !== 60)) {
    errors.push(`Answer positions are ${JSON.stringify(answerPositions)}, expected [60,60,60,60].`);
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
const sqlPath = resolve("deliverables/CHM101_import_exam_bank_240.sql");
const markdownPath = resolve("deliverables/CHM101_question_bank_240.md");
mkdirSync(dirname(sqlPath), { recursive: true });
writeFileSync(sqlPath, renderSql(rows), "utf8");
writeFileSync(markdownPath, renderMarkdown(), "utf8");
console.log(JSON.stringify({ ...summary, sqlPath, markdownPath }, null, 2));
