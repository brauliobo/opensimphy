const TOPICS = [
  {
    id: "foundations",
    order: 1,
    title: "Fundamental anchors & natural scales",
    shortTitle: "Anchors & scales",
    eyebrow: "Define the stage",
    description: "The clocks, action quanta, light speed, gravity, and natural scales that anchor the rest of the catalog.",
    narrative: "Start with what fixes a second, carries a quantum of action, limits propagation, and sets gravitational scale.",
    expectedCount: 15,
    featuredNames: [
      "hyperfine transition frequency of Cs-133",
      "Planck constant",
      "Newtonian constant of gravitation",
      "luminous efficacy",
    ],
    categories: [
      { id: "si-observational-anchors", title: "SI & observational anchors", description: "Defined and measured reference quantities for time, action, light, and photometry.", expectedCount: 5 },
      { id: "quantum-natural-scales", title: "Quantum & natural scales", description: "Action, circulation, Planck-energy, and natural-unit forms.", expectedCount: 8 },
      { id: "gravity", title: "Gravity", description: "Newtonian coupling and its dimensionless natural-unit form.", expectedCount: 2 },
    ],
  },
  {
    id: "metrology",
    order: 2,
    title: "Unit bridges & conventional metrology",
    shortTitle: "Unit bridges",
    eyebrow: "Translate the measures",
    description: "Reciprocal bridges between frequency, energy, mass, temperature, and wavenumber, plus the 1990 electrical conventions.",
    narrative: "Follow one physical quantity as laboratory practice expresses it in another unit language.",
    expectedCount: 60,
    featuredNames: [
      "electron volt-hertz relationship",
      "electron volt-kilogram relationship",
      "kelvin-joule relationship",
      "conventional value of ampere-90",
    ],
    categories: [
      { id: "frequency-bridges", title: "Frequency bridges", description: "Conversions between hertz and energy standards.", expectedCount: 10 },
      { id: "energy-mass-bridges", title: "Energy & mass bridges", description: "Joule, electron-volt, kilogram, and atomic-mass translations.", expectedCount: 17 },
      { id: "wavenumber-bridges", title: "Wavenumber bridges", description: "Inverse-metre forms of energy and frequency scales.", expectedCount: 12 },
      { id: "temperature-bridges", title: "Temperature bridges", description: "Kelvin relationships to energy, mass, frequency, and wavenumber.", expectedCount: 14 },
      { id: "conventional-1990", title: "1990 electrical conventions", description: "Historical ampere, coulomb, farad, henry, ohm, volt, and watt values.", expectedCount: 7 },
    ],
  },
  {
    id: "electromagnetism",
    order: 3,
    title: "Quantum electrical standards & vacuum electromagnetism",
    shortTitle: "Electrical standards",
    eyebrow: "Quantize charge",
    description: "Electrical quanta and the vacuum response constants that connect charge, conductance, impedance, and potential.",
    narrative: "Move from a single charge quantum to resistance standards and the electrical properties assigned to empty space.",
    expectedCount: 10,
    featuredNames: [
      "conductance quantum",
      "electron volt",
      "Coulomb's constant",
      "characteristic impedance of vacuum",
    ],
    categories: [
      { id: "quantum-electrical-standards", title: "Quantum electrical standards", description: "Conductance, resistance, Josephson, charge, and electron-volt standards.", expectedCount: 6 },
      { id: "vacuum-electrostatics", title: "Vacuum electrostatics & impedance", description: "Coulomb coupling, vacuum permittivity, and characteristic impedance.", expectedCount: 3 },
      { id: "planck-impedance", title: "Planck electrical impedance", description: "The natural-scale electrical impedance.", expectedCount: 1 },
    ],
  },
  {
    id: "atomic",
    order: 4,
    title: "Atomic structure, atomic units & materials",
    shortTitle: "Atoms & materials",
    eyebrow: "Enter the atom",
    description: "Spectroscopic scales, atomic mechanical and electrical units, silicon structure, radii, and scattering.",
    narrative: "Use the standards to measure bound states, atomic motion, field response, and a crystalline material.",
    expectedCount: 26,
    featuredNames: [
      "Rydberg constant",
      "atomic unit of time",
      "lattice parameter of silicon",
      "Thomson cross section",
    ],
    categories: [
      { id: "spectroscopy-bound-states", title: "Spectroscopy & bound states", description: "Rydberg and Hartree forms for atomic spectra and binding energy.", expectedCount: 5 },
      { id: "materials-radii-scattering", title: "Materials, radii & scattering", description: "Silicon lattice measures, electron radius, and Thomson scattering.", expectedCount: 4 },
      { id: "atomic-mechanical-units", title: "Atomic mechanical units", description: "Atomic time, velocity, momentum, length, and force.", expectedCount: 5 },
      { id: "atomic-electrical-response", title: "Atomic electrical response", description: "Atomic field, potential, density, moment, polarizability, and response units.", expectedCount: 12 },
    ],
  },
  {
    id: "particles",
    order: 5,
    title: "Particle & nuclear masses and energy scales",
    shortTitle: "Particles & mass",
    eyebrow: "Weigh the particles",
    description: "Lepton, nucleon, and light-nucleus masses across direct, relative, energy, momentum, and wavelength representations.",
    narrative: "Compare matter from the electron through light nuclei, then read each mass as energy, wavelength, or relative scale.",
    expectedCount: 64,
    featuredNames: [
      "electron mass",
      "proton mass",
      "Fermi coupling constant",
      "reduced Compton wavelength",
    ],
    categories: [
      { id: "direct-masses", title: "Direct masses & differences", description: "Particle masses, mass differences, and charge-to-mass quotients.", expectedCount: 14 },
      { id: "mass-energy-equivalents", title: "Mass-energy equivalents", description: "Rest mass, natural energy, and mass differences represented as energy.", expectedCount: 21 },
      { id: "relative-unified-masses", title: "Relative & unified masses", description: "Relative atomic masses and values in unified atomic mass units.", expectedCount: 16 },
      { id: "compton-wavelengths", title: "Compton wavelengths", description: "Ordinary and reduced quantum wavelengths for massive particles.", expectedCount: 10 },
      { id: "momentum-weak-scales", title: "Momentum & weak scales", description: "Natural momentum forms and the Fermi coupling scale.", expectedCount: 3 },
    ],
  },
  {
    id: "magnetism",
    order: 6,
    title: "Spin, moments & magnetic response",
    shortTitle: "Spin & magnetism",
    eyebrow: "Resolve the spin",
    description: "Magnetons, particle moments, moment ratios, g-factors, anomalies, gyromagnetic response, shielding, permeability, and flux.",
    narrative: "The largest family tracks how spin and composite structure appear in magnetic measurements and ratios.",
    expectedCount: 81,
    featuredNames: [
      "Bohr magneton",
      "electron magnetic moment anomaly",
      "electron gyromagnetic ratio",
      "proton g factor",
    ],
    categories: [
      { id: "moments-field-standards", title: "Moments & field standards", description: "Magnetons, magnetic moments, permeability, and flux standards.", expectedCount: 23 },
      { id: "moment-ratios", title: "Moment ratios", description: "Particle-to-particle and moment-to-magneton comparisons.", expectedCount: 35 },
      { id: "gyromagnetic-ratios", title: "Gyromagnetic ratios", description: "Spin precession response in frequency and angular-frequency forms.", expectedCount: 10 },
      { id: "g-factors-anomalies", title: "g-factors & anomalies", description: "Dimensionless spin factors and departures from ideal magnetic moments.", expectedCount: 9 },
      { id: "shielding-corrections", title: "Shielding corrections", description: "Helion shifts, molecular differences, and proton shielding corrections.", expectedCount: 4 },
    ],
  },
  {
    id: "thermal",
    order: 7,
    title: "Thermal physics, standard states & radiation",
    shortTitle: "Heat & radiation",
    eyebrow: "Raise the temperature",
    description: "Microscopic thermal energy, ideal-gas states, entropy references, black-body displacement, and radiative power.",
    narrative: "Connect particle-scale energy to temperature, standard gases, entropy, peak wavelength, and emitted power.",
    expectedCount: 17,
    featuredNames: [
      "Boltzmann constant",
      "molar gas constant",
      "Wien wavelength displacement law constant",
      "Stefan-Boltzmann constant",
    ],
    categories: [
      { id: "boltzmann-forms", title: "Boltzmann forms", description: "The thermal-energy constant in its direct and alternate forms.", expectedCount: 4 },
      { id: "gas-standard-states", title: "Gas & standard states", description: "Molar volumes, Loschmidt densities, and Sackur-Tetrode references.", expectedCount: 7 },
      { id: "thermal-radiation", title: "Thermal radiation", description: "Radiation constants, Wien displacement laws, and Stefan-Boltzmann emission.", expectedCount: 6 },
    ],
  },
  {
    id: "molar-matter",
    order: 8,
    title: "Amount of substance & molar matter",
    shortTitle: "Molar matter",
    eyebrow: "Scale up to matter",
    description: "Avogadro-scale anchors, molar electromagnetic and action constants, molar masses, and silicon molar volume.",
    narrative: "Finish by lifting particle constants into laboratory amounts of substance and bulk material.",
    expectedCount: 15,
    featuredNames: [
      "Avogadro constant",
      "Faraday constant",
      "electron molar mass",
      "molar volume of silicon",
    ],
    categories: [
      { id: "amount-anchors", title: "Amount-of-substance anchors", description: "Avogadro, Faraday, and molar Planck constants.", expectedCount: 3 },
      { id: "molar-mass-series", title: "Molar-mass series", description: "Molar masses for particles, nuclei, and carbon-12.", expectedCount: 11 },
      { id: "silicon-molar-volume", title: "Silicon molar volume", description: "A bulk-material bridge from lattice structure to amount of substance.", expectedCount: 1 },
    ],
  },
];

const FOUNDATION_RECIPES = new Set([1, 6, 7, 8, 9, 10, 50, 51, 70, 73, 145, 176, 201, 220, 221]);

function topicId(recipe) {
  const name = recipe.display_name;
  if (/relationship|conventional value/i.test(name)) return "metrology";
  if (/magnetic|magneton|gyromagnetic|g factor|moment anomaly|shielding|permeability|flux quantum/i.test(name)) return "magnetism";
  if (/Boltzmann|Wien|radiation constant|Stefan-Boltzmann|ideal gas|Loschmidt|Sackur-Tetrode|molar gas constant/i.test(name)) return "thermal";
  if (/molar|Avogadro|Faraday/i.test(name)) return "molar-matter";
  if (FOUNDATION_RECIPES.has(recipe.recipe_number)) return "foundations";
  if (/mass|energy equivalent|relative atomic|Compton wavelength|Fermi coupling|natural unit of momentum|natural unit of energy|charge to mass quotient/i.test(name)) return "particles";
  if (/atomic unit|Rydberg|Hartree|lattice|silicon|Thomson cross|classical electron radius/i.test(name)) return "atomic";
  if (/charge|conductance|electron volt|Coulomb|permittivity|impedance|Josephson|electric|Klitzing/i.test(name)) return "electromagnetism";
  throw new Error(`No topic classification for recipe ${recipe.recipe_number}: ${name}`);
}

function categoryId(topic, name) {
  if (topic === "foundations") {
    if (/gravitation/i.test(name)) return "gravity";
    if (/hyperfine|^Planck constant$|^reduced Planck constant$|speed of light|luminous efficacy/i.test(name)) return "si-observational-anchors";
    return "quantum-natural-scales";
  }
  if (topic === "metrology") {
    if (/conventional value/i.test(name)) return "conventional-1990";
    if (/kelvin/i.test(name)) return "temperature-bridges";
    if (/inverse meter/i.test(name)) return "wavenumber-bridges";
    if (/hertz/i.test(name)) return "frequency-bridges";
    return "energy-mass-bridges";
  }
  if (topic === "electromagnetism") {
    if (/Coulomb|vacuum electric permittivity|characteristic impedance/i.test(name)) return "vacuum-electrostatics";
    if (/Planck electric impedance/i.test(name)) return "planck-impedance";
    return "quantum-electrical-standards";
  }
  if (topic === "atomic") {
    if (/Rydberg|Hartree/i.test(name)) return "spectroscopy-bound-states";
    if (/lattice|silicon|Thomson|classical electron radius/i.test(name)) return "materials-radii-scattering";
    if (/atomic unit of (time|velocity|momentum|length|force)/i.test(name)) return "atomic-mechanical-units";
    return "atomic-electrical-response";
  }
  if (topic === "particles") {
    if (/Compton wavelength/i.test(name)) return "compton-wavelengths";
    if (/energy equivalent|natural unit of energy/i.test(name)) return "mass-energy-equivalents";
    if (/relative atomic mass|mass in u/i.test(name)) return "relative-unified-masses";
    if (/natural unit of momentum|Fermi coupling/i.test(name)) return "momentum-weak-scales";
    return "direct-masses";
  }
  if (topic === "magnetism") {
    if (/shielding (shift|difference|correction)|shielding difference/i.test(name)) return "shielding-corrections";
    if (/gyromagnetic/i.test(name)) return "gyromagnetic-ratios";
    if (/g factor|moment anomaly/i.test(name)) return "g-factors-anomalies";
    if (/ratio/i.test(name)) return "moment-ratios";
    return "moments-field-standards";
  }
  if (topic === "thermal") {
    if (/radiation|Wien|Stefan/i.test(name)) return "thermal-radiation";
    if (/Boltzmann/i.test(name)) return "boltzmann-forms";
    return "gas-standard-states";
  }
  if (topic === "molar-matter") {
    if (/molar volume of silicon/i.test(name)) return "silicon-molar-volume";
    if (/molar mass/i.test(name)) return "molar-mass-series";
    return "amount-anchors";
  }
  throw new Error(`Unknown taxonomy topic: ${topic}`);
}

function sourceUnitFamily(dimension) {
  if (dimension === "-" || dimension === "dimensionless") return "dimensionless";
  if (/mol/.test(dimension)) return "molar";
  if (/\bK\b/.test(dimension)) return "thermal";
  if (/\b(?:T|Wb)\b/.test(dimension)) return "magnetic";
  if (/\b(?:C|V|ohm|F|H|S|A)\b/.test(dimension)) return "electrical";
  if (/\b(?:kg|u)\b/.test(dimension)) return "mass";
  if (/\b(?:J|eV|MeV|GeV|E_h)\b/.test(dimension)) return "energy-action";
  if (/\b(?:Hz|MHz|s)\b/.test(dimension)) return "time-frequency";
  if (/\bm\b/.test(dimension)) return "spatial";
  return "other-declared-unit";
}

function representation(name) {
  if (/conventional value/i.test(name)) return "conventional-standard";
  if (/relationship/i.test(name)) return "unit-relationship";
  if (/energy equivalent/i.test(name)) return "energy-equivalent";
  if (/relative atomic mass/i.test(name)) return "relative-mass";
  if (/mass in u/i.test(name)) return "unified-mass";
  if (/Compton wavelength/i.test(name)) return "quantum-wavelength";
  if (/ratio/i.test(name)) return "ratio";
  if (/ in (eV|MeV|GeV|Hz|MHz|inverse meter)/i.test(name)) return "alternate-unit-form";
  if (/molar/i.test(name)) return "molar-form";
  return "primary-form";
}

const ENTITY_PATTERNS = [
  ["cesium-133", /Cs-133|cesium-133/i],
  ["electron", /electron/i],
  ["muon", /muon/i],
  ["tau", /\btau\b/i],
  ["proton", /proton/i],
  ["neutron", /neutron/i],
  ["deuteron", /deuteron/i],
  ["triton", /triton/i],
  ["helion", /helion/i],
  ["alpha-particle", /alpha particle/i],
  ["silicon", /silicon|\bSi\b/i],
  ["carbon-12", /carbon-12/i],
  ["vacuum", /vacuum/i],
];

function entities(name) {
  return ENTITY_PATTERNS.filter(([, pattern]) => pattern.test(name)).map(([id]) => id);
}

function classifyRecipe(recipe) {
  const topic = topicId(recipe);
  const category = categoryId(topic, recipe.display_name);
  return {
    topic,
    category,
    facets: {
      basis: recipe.expected_kind,
      constructor: recipe.combine === "inversion" ? "inversion" : recipe.combine === "+" ? "addition" : recipe.combine === "-" ? "subtraction" : "multiplication",
      buildPass: `pass-${recipe.published_result.buildPass}`,
      sourceUnitFamily: sourceUnitFamily(recipe.dimension),
      representation: representation(recipe.display_name),
      entities: entities(recipe.display_name),
      sourceColumn: recipe.column,
      sourceIsland: recipe.island,
    },
  };
}

function countValues(classifications, valueAt) {
  const counts = new Map();
  for (const item of classifications) {
    const values = valueAt(item);
    for (const value of Array.isArray(values) ? values : [values]) {
      if (!value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts].sort(([left], [right]) => left.localeCompare(right, "en")).map(([id, count]) => ({ id, count }));
}

export function buildConstantTaxonomy(recipes, generatedAt) {
  const classifiedRecipes = recipes.map((recipe) => ({ ...recipe, taxonomy: classifyRecipe(recipe) }));
  const topicSummaries = TOPICS.map((topic) => {
    const members = classifiedRecipes.filter((recipe) => recipe.taxonomy.topic === topic.id);
    if (members.length !== topic.expectedCount) throw new Error(`Topic ${topic.id} expected ${topic.expectedCount} recipes, found ${members.length}`);
    const categories = topic.categories.map((category) => {
      const categoryMembers = members.filter((recipe) => recipe.taxonomy.category === category.id);
      if (categoryMembers.length !== category.expectedCount) throw new Error(`Category ${topic.id}/${category.id} expected ${category.expectedCount} recipes, found ${categoryMembers.length}`);
      const { expectedCount: _expectedCount, ...metadata } = category;
      return { ...metadata, count: categoryMembers.length };
    });
    const categoryTotal = categories.reduce((total, category) => total + category.count, 0);
    if (categoryTotal !== members.length) throw new Error(`Category coverage for ${topic.id} is ${categoryTotal}/${members.length}`);
    const featured = topic.featuredNames.map((name) => {
      const recipe = members.find((item) => item.display_name === name);
      if (!recipe) throw new Error(`Featured constant '${name}' is not classified under ${topic.id}`);
      return { recipeNumber: recipe.recipe_number, id: recipe.constant_id, name: recipe.display_name };
    });
    return {
      id: topic.id,
      order: topic.order,
      title: topic.title,
      shortTitle: topic.shortTitle,
      eyebrow: topic.eyebrow,
      description: topic.description,
      narrative: topic.narrative,
      count: members.length,
      exactCount: members.filter((recipe) => recipe.expected_kind === "exact").length,
      measuredCount: members.filter((recipe) => recipe.expected_kind === "measured").length,
      categories,
      featured,
    };
  });
  const total = topicSummaries.reduce((sum, topic) => sum + topic.count, 0);
  if (total !== recipes.length) throw new Error(`Taxonomy covers ${total}/${recipes.length} recipes`);
  return {
    recipes: classifiedRecipes,
    artifact: {
      schemaVersion: 1,
      generatedAt,
      total,
      narrativeOrder: topicSummaries.map((topic) => topic.id),
      topics: topicSummaries,
      facets: {
        basis: countValues(classifiedRecipes, (recipe) => recipe.taxonomy.facets.basis),
        constructor: countValues(classifiedRecipes, (recipe) => recipe.taxonomy.facets.constructor),
        buildPass: countValues(classifiedRecipes, (recipe) => recipe.taxonomy.facets.buildPass),
        sourceUnitFamily: countValues(classifiedRecipes, (recipe) => recipe.taxonomy.facets.sourceUnitFamily),
        representation: countValues(classifiedRecipes, (recipe) => recipe.taxonomy.facets.representation),
        entities: countValues(classifiedRecipes, (recipe) => recipe.taxonomy.facets.entities),
      },
    },
  };
}
