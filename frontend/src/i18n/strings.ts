/**
 * UI string dictionary for the English / Odia toggle.
 *
 * Structure mirrors the screens: one key group per screen or shared component.
 * Every leaf is `{ en, or }` — "or" is the ISO 639-1 code for Odia (Oriya).
 * DATA (mother/child/village names, PHC locations, seeded records) is never
 * translated here — only chrome: labels, buttons, headers, empty/error states.
 *
 * Glossary-backed terms come from docs/odia-glossary.md and must stay consistent
 * across screens. Clinical abbreviations (ANC, BP, Hb, EDD, FHR, LMP) are kept
 * as-is on purpose — that matches field usage.
 *
 * `// REVIEW` marks an Odia value a native speaker should confirm before the
 * demo (clinical phrasing or a term not covered by the glossary).
 */

export type Lang = "en" | "or";

// Deep type: same shape as STRINGS but every leaf collapsed to a plain string.
export type Translations = {
  [K in keyof typeof STRINGS]: {
    [P in keyof (typeof STRINGS)[K]]: string;
  };
};

export const STRINGS = {
  common: {
    save: { en: "Save", or: "ସେଭ କରନ୍ତୁ" },
    cancel: { en: "Cancel", or: "ବାତିଲ କରନ୍ତୁ" },
    retry: { en: "Retry", or: "ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ" },
    search: { en: "Search", or: "ଖୋଜନ୍ତୁ" },
    close: { en: "Close", or: "ବନ୍ଦ କରନ୍ତୁ" },
    change: { en: "Change", or: "ବଦଳାନ୍ତୁ" },
    viewAll: { en: "View all", or: "ସବୁ ଦେଖନ୍ତୁ" },
    viewMore: { en: "View more", or: "ଅଧିକ ଦେଖନ୍ତୁ" },
    online: { en: "Online", or: "ଅନଲାଇନ" },
    offline: { en: "Offline", or: "ଅଫଲାଇନ" },
    syncedAt: { en: "Synced", or: "ସିଙ୍କ ହୋଇଛି" },
    couldntLoad: { en: "Couldn't load", or: "ଲୋଡ୍ ହୋଇପାରିଲା ନାହିଁ" },
    loadErrorDefault: {
      en: "Can't reach the server right now.",
      or: "ବର୍ତ୍ତମାନ ସର୍ଭରରେ ପହଞ୍ଚିପାରୁନାହିଁ।", // REVIEW
    },
    dashCaseloadPregnancies: { en: "pregnancies", or: "ଗର୍ଭାବସ୍ଥା" },
    dashCaseloadChildren: { en: "children registered", or: "ଶିଶୁ ପଞ୍ଜୀକୃତ" },
    roleHealthWorker: { en: "Health Worker", or: "ସ୍ୱାସ୍ଥ୍ୟ କର୍ମୀ" },
    roleAdministrator: { en: "Administrator", or: "ପ୍ରଶାସକ" },
  },

  nav: {
    home: { en: "Home", or: "ମୂଳପୃଷ୍ଠା" },
    pregnancy: { en: "Pregnancy", or: "ଗର୍ଭାବସ୍ଥା" },
    children: { en: "Children", or: "ଶିଶୁମାନେ" },
    alerts: { en: "Alerts", or: "ସତର୍କତା" },
    profile: { en: "Profile", or: "ପ୍ରୋଫାଇଲ" },
  },

  // Enum-ish values that live in seed data but read as UI. Mapped for display
  // only via statusLabel()/priorityLabel(); the stored data stays English.
  status: {
    completed: { en: "Completed", or: "ସମ୍ପୂର୍ଣ୍ଣ" },
    due: { en: "Due", or: "ଦେୟ" },
    overdue: { en: "Overdue", or: "ବିଳମ୍ବିତ" },
    upcoming: { en: "Upcoming", or: "ଆସନ୍ତା" },
    scheduled: { en: "Scheduled", or: "ନିର୍ଦ୍ଧାରିତ" }, // REVIEW
    normal: { en: "Normal", or: "ସାଧାରଣ" },
    highRisk: { en: "High Risk", or: "ଉଚ୍ଚ ବିପଦ" },
    delivered: { en: "Delivered", or: "ପ୍ରସବ ହୋଇଛି" }, // REVIEW
    active: { en: "Active", or: "ସକ୍ରିୟ" },
  },

  priority: {
    CRITICAL: { en: "Critical", or: "ଗୁରୁତର" },
    HIGH: { en: "High", or: "ଉଚ୍ଚ" },
    MEDIUM: { en: "Medium", or: "ମଧ୍ୟମ" },
    LOW: { en: "Low", or: "ନିମ୍ନ" },
  },

  header: {
    offlineRibbon: {
      en: "Offline mode • {count} records queued on this device • Tap to sync",
      or: "ଅଫଲାଇନ ମୋଡ୍ • ଏହି ଡିଭାଇସରେ {count} ରେକର୍ଡ କ୍ୟୁରେ • ସିଙ୍କ ପାଇଁ ଟ୍ୟାପ୍ କରନ୍ତୁ", // REVIEW
    },
  },

  login: {
    govPortal: {
      en: "National Health Mission · State Portal",
      or: "ଜାତୀୟ ସ୍ୱାସ୍ଥ୍ୟ ମିଶନ · ରାଜ୍ୟ ପୋର୍ଟାଲ", // REVIEW
    },
    tagline: {
      en: "Digital Care for Every Mother, Protection for Every Child",
      or: "ପ୍ରତ୍ୟେକ ମାଆ ପାଇଁ ଡିଜିଟାଲ ଯତ୍ନ, ପ୍ରତ୍ୟେକ ଶିଶୁ ପାଇଁ ସୁରକ୍ଷା", // REVIEW
    },
    officialPortalFor: {
      en: "Official Field Portal for ANM, ASHA & Supervisory Medical Officers",
      or: "ANM, ASHA ଏବଂ ତତ୍ତ୍ୱାବଧାନ ମେଡିକାଲ ଅଫିସରଙ୍କ ପାଇଁ ସରକାରୀ କ୍ଷେତ୍ର ପୋର୍ଟାଲ", // REVIEW
    },
    selectRole: { en: "Select your role to continue", or: "ଆଗକୁ ବଢ଼ିବା ପାଇଁ ଆପଣଙ୍କ ଭୂମିକା ବାଛନ୍ତୁ" },
    healthWorkerLogin: { en: "Health Worker Login", or: "ସ୍ୱାସ୍ଥ୍ୟ କର୍ମୀ ଲଗଇନ" },
    healthWorkerDesc: { en: "ANM / ASHA field worker access", or: "ANM / ASHA କ୍ଷେତ୍ର କର୍ମୀ ପ୍ରବେଶ" },
    adminLogin: { en: "Administrator Login", or: "ପ୍ରଶାସକ ଲଗଇନ" },
    adminDesc: { en: "District / block oversight access", or: "ଜିଲ୍ଲା / ବ୍ଲକ ତଦାରଖ ପ୍ରବେଶ" },
    roleLoginSuffix: { en: "Login", or: "ଲଗଇନ" },
    usernameLabel: { en: "Username / Mobile Number", or: "ଉପଯୋଗକର୍ତ୍ତା ନାମ / ମୋବାଇଲ ନମ୍ବର" },
    usernamePlaceholder: { en: "Enter your username", or: "ଆପଣଙ୍କ ଉପଯୋଗକର୍ତ୍ତା ନାମ ଦିଅନ୍ତୁ" },
    passwordLabel: { en: "Password", or: "ପାସୱାର୍ଡ" },
    passwordPlaceholder: { en: "Enter your password", or: "ଆପଣଙ୍କ ପାସୱାର୍ଡ ଦିଅନ୍ତୁ" },
    rememberSession: { en: "Remember session", or: "ସେସନ ମନେ ରଖନ୍ତୁ" },
    forgotPassword: { en: "Forgot Password?", or: "ପାସୱାର୍ଡ ଭୁଲିଗଲେ?" },
    signIn: { en: "Sign In to MCH Portal", or: "MCH ପୋର୍ଟାଲରେ ସାଇନ ଇନ କରନ୍ତୁ" },
    needBoth: {
      en: "Please enter both username/mobile and password",
      or: "ଦୟାକରି ଉପଯୋଗକର୍ତ୍ତା ନାମ/ମୋବାଇଲ ଏବଂ ପାସୱାର୍ଡ ଦୁହେଁ ଦିଅନ୍ତୁ",
    },
    invalidCreds: {
      en: "Invalid credentials. Please try again.",
      or: "ଅବୈଧ ପ୍ରମାଣପତ୍ର। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।",
    },
    securityNotice: {
      en: "Encrypted session · Works offline · v2.6.4",
      or: "ଏନକ୍ରିପ୍ଟେଡ ସେସନ · ଅଫଲାଇନ କାମ କରେ · v2.6.4", // REVIEW
    },
    recoveryTitle: { en: "Credential Recovery", or: "ପ୍ରମାଣପତ୍ର ପୁନରୁଦ୍ଧାର" }, // REVIEW
    recoveryBody: {
      en: "In field deployment, password resets are authorized by the PHC Medical Officer or Block Program Manager.\n\nFor this demo prototype, use:\n• Admin: admin / Admin@123\n• Worker: worker01 / Worker@123",
      or: "କ୍ଷେତ୍ର ମୋତାୟନରେ, ପାସୱାର୍ଡ ରିସେଟ PHC ମେଡିକାଲ ଅଫିସର କିମ୍ବା ବ୍ଲକ ପ୍ରୋଗ୍ରାମ ମ୍ୟାନେଜରଙ୍କ ଦ୍ୱାରା ଅନୁମୋଦିତ ହୁଏ।\n\nଏହି ଡେମୋ ପାଇଁ, ବ୍ୟବହାର କରନ୍ତୁ:\n• Admin: admin / Admin@123\n• Worker: worker01 / Worker@123", // REVIEW
    },
    closeReturn: { en: "Close & Return to Login", or: "ବନ୍ଦ କରି ଲଗଇନକୁ ଫେରନ୍ତୁ" },
    demoAccounts: { en: "Demo accounts", or: "ଡେମୋ ଆକାଉଣ୍ଟ" },
    demoOnly: { en: "DEMO ONLY", or: "କେବଳ ଡେମୋ" },
    demoNote: {
      en: "Sample data only — this app runs fully offline for the demo.",
      or: "କେବଳ ନମୁନା ତଥ୍ୟ — ଏହି ଆପ୍ ଡେମୋ ପାଇଁ ସମ୍ପୂର୍ଣ୍ଣ ଅଫଲାଇନ ଚାଲେ।", // REVIEW
    },
  },

  dashboard: {
    loading: { en: "Synchronising live registries…", or: "ଲାଇଭ ରେଜିଷ୍ଟ୍ରି ସିଙ୍କ ହେଉଛି…" }, // REVIEW
    loadFailed: { en: "Failed to load dashboard metrics.", or: "ଡ୍ୟାସବୋର୍ଡ ମେଟ୍ରିକ୍ସ ଲୋଡ୍ ହୋଇପାରିଲା ନାହିଁ।" },
    fallbackPhc: { en: "Primary Health Centre", or: "ପ୍ରାଥମିକ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର" },
    fallbackArea: { en: "Field area", or: "କ୍ଷେତ୍ର ଅଞ୍ଚଳ" },
    recordsWaiting: {
      en: "records waiting for synchronization",
      or: "ରେକର୍ଡ ସିଙ୍କ୍ରୋନାଇଜେସନ ପାଇଁ ଅପେକ୍ଷାରତ", // REVIEW
    },
    priorityAlerts: { en: "Priority alerts", or: "ପ୍ରାଥମିକତା ସତର୍କତା" },
    allUpToDate: { en: "Everyone in your area is up to date.", or: "ଆପଣଙ୍କ ଅଞ୍ଚଳର ସମସ୍ତେ ଅଦ୍ୟତନ ଅଛନ୍ତି।" }, // REVIEW
    criticalFollowUp: { en: "Critical pregnancies — follow up", or: "ଗୁରୁତର ଗର୍ଭାବସ୍ଥା — ଅନୁସରଣ ଆବଶ୍ୟକ" }, // REVIEW
    noCritical: { en: "No critical pregnancies right now.", or: "ବର୍ତ୍ତମାନ କୌଣସି ଗୁରୁତର ଗର୍ଭାବସ୍ଥା ନାହିଁ।" }, // REVIEW
    needsAttention: { en: "Needs attention", or: "ଧ୍ୟାନ ଆବଶ୍ୟକ" },
    highRiskPregnancies: { en: "High-risk pregnancies", or: "ଉଚ୍ଚ ବିପଦପୂର୍ଣ୍ଣ ଗର୍ଭାବସ୍ଥା" },
    ancDue: { en: "ANC due", or: "ANC ଦେୟ" },
    ancOverdue: { en: "ANC overdue", or: "ANC ବିଳମ୍ବିତ" },
    matVaccineDue: { en: "Maternal vaccine due", or: "ମାତୃ ଟୀକା ଦେୟ" },
    matVaccineOverdue: { en: "Maternal vaccine overdue", or: "ମାତୃ ଟୀକା ବିଳମ୍ବିତ" },
    pmsma: { en: "PMSMA", or: "PMSMA" },
    epmsma: { en: "ePMSMA", or: "ePMSMA" },
    quickActions: { en: "Quick actions", or: "ଶୀଘ୍ର କାର୍ଯ୍ୟ" },
    qaRegisterPregnancy: { en: "Register\nPregnancy", or: "ଗର୍ଭାବସ୍ଥା\nପଞ୍ଜୀକରଣ" },
    qaRegisterChild: { en: "Register\nChild", or: "ଶିଶୁ\nପଞ୍ଜୀକରଣ" },
    qaRecordAnc: { en: "Record\nANC Visit", or: "ANC ପରିଦର୍ଶନ\nରେକର୍ଡ" },
    qaSyncCenter: { en: "Sync\nCenter", or: "ସିଙ୍କ\nକେନ୍ଦ୍ର" },
    recentRegistrations: { en: "Recent registrations", or: "ସାମ୍ପ୍ରତିକ ପଞ୍ଜୀକରଣ" },
    caseloadOverview: { en: "Caseload overview", or: "କେସଲୋଡ ସାରାଂଶ" }, // REVIEW
    totalPregnancies: { en: "Total pregnancies", or: "ମୋଟ ଗର୍ଭାବସ୍ଥା" },
    registeredChildren: { en: "Registered children", or: "ପଞ୍ଜୀକୃତ ଶିଶୁ" },
    trimester1: { en: "1st trimester", or: "୧ମ ତ୍ରୈମାସିକ" },
    trimester2: { en: "2nd trimester", or: "୨ୟ ତ୍ରୈମାସିକ" },
    trimester3: { en: "3rd trimester", or: "୩ୟ ତ୍ରୈମାସିକ" },
    immDisclaimer: {
      en: "Immunisation dates follow a sample schedule. Confirm against the approved national schedule before clinical use.",
      or: "ଟୀକାକରଣ ତାରିଖଗୁଡ଼ିକ ଏକ ନମୁନା ସୂଚୀ ଅନୁସରଣ କରେ। କ୍ଲିନିକାଲ ବ୍ୟବହାର ପୂର୍ବରୁ ଅନୁମୋଦିତ ଜାତୀୟ ସୂଚୀ ସହିତ ମିଳାନ୍ତୁ।", // REVIEW
    },
  },

  // Dummy assistant entry point on the Dashboard FAB — canned quick replies only,
  // no real conversation or backend.
  chatAssistant: {
    a11yLabel: { en: "Open assistant", or: "ସହାୟକ ଖୋଲନ୍ତୁ" }, // REVIEW
    greeting: { en: "Hi! What would you like to do?", or: "ନମସ୍କାର! ଆପଣ କଣ କରିବାକୁ ଚାହୁଁଛନ୍ତି?" }, // REVIEW
    optionRegisterPregnancy: { en: "Register a pregnancy", or: "ଏକ ଗର୍ଭାବସ୍ଥା ପଞ୍ଜୀକରଣ କରନ୍ତୁ" },
    optionViewAlerts: { en: "View alerts", or: "ସତର୍କତା ଦେଖନ୍ତୁ" },
    optionCheckPmsma: { en: "Check PMSMA status", or: "PMSMA ସ୍ଥିତି ଯାଞ୍ଚ କରନ୍ତୁ" }, // REVIEW
    optionGoDashboard: { en: "Go to dashboard", or: "ଡ୍ୟାସବୋର୍ଡକୁ ଯାଆନ୍ତୁ" }, // REVIEW
    optionNeedHelp: { en: "Need help?", or: "ସାହାଯ୍ୟ ଆବଶ୍ୟକ?" }, // REVIEW
    helpMessage: {
      en: "Contact your PHC supervisor for further assistance.",
      or: "ଅଧିକ ସହାୟତା ପାଇଁ ଆପଣଙ୍କ PHC ତତ୍ତ୍ୱାବଧାରକଙ୍କ ସହିତ ଯୋଗାଯୋଗ କରନ୍ତୁ।", // REVIEW
    },
  },

  pregnancyList: {
    title: { en: "Pregnancy Registry", or: "ଗର୍ଭାବସ୍ଥା ରେଜିଷ୍ଟ୍ରି" },
    searchPlaceholder: { en: "Search name, ID, mobile, village…", or: "ନାମ, ID, ମୋବାଇଲ, ଗ୍ରାମ ଖୋଜନ୍ତୁ…" },
    filterAll: { en: "All", or: "ସମସ୍ତ" },
    filterHighRisk: { en: "High Risk", or: "ଉଚ୍ଚ ବିପଦ" },
    filterT1: { en: "1st Trimester", or: "୧ମ ତ୍ରୈମାସିକ" },
    filterT2: { en: "2nd Trimester", or: "୨ୟ ତ୍ରୈମାସିକ" },
    filterT3: { en: "3rd Trimester", or: "୩ୟ ତ୍ରୈମାସିକ" },
    filterDelivered: { en: "Delivered", or: "ପ୍ରସବ ହୋଇଛି" }, // REVIEW
    countFound: { en: "beneficiaries found", or: "ହିତାଧିକାରୀ ମିଳିଲେ" }, // REVIEW
    riskTag: { en: "HIGH RISK", or: "ଉଚ୍ଚ ବିପଦ" },
    wifeOf: { en: "W/o", or: "ପତି:" }, // REVIEW – "W/o" = wife of; Odia rendered "Husband:" for a natural one-line label
    age: { en: "Age", or: "ବୟସ" },
    noMatch: { en: "No beneficiaries match this search or filter.", or: "ଏହି ଖୋଜା କିମ୍ବା ଫିଲ୍ଟର ସହିତ କୌଣସି ହିତାଧିକାରୀ ମେଳ ଖାଉନାହାଁନ୍ତି।" }, // REVIEW
    clearFilters: { en: "Clear search & filters", or: "ଖୋଜା ଏବଂ ଫିଲ୍ଟର ସଫା କରନ୍ତୁ" },
    noneYet: { en: "No pregnancies registered yet.", or: "ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ଗର୍ଭାବସ୍ଥା ପଞ୍ଜୀକୃତ ନାହିଁ।" },
    registerOne: { en: "Register a pregnancy", or: "ଏକ ଗର୍ଭାବସ୍ଥା ପଞ୍ଜୀକରଣ କରନ୍ତୁ" },
  },

  pregnancyDetail: {
    title: { en: "Pregnancy Record", or: "ଗର୍ଭାବସ୍ଥା ରେକର୍ଡ" },
    notFound: { en: "This record could not be found. It may have been removed.", or: "ଏହି ରେକର୍ଡ ମିଳିଲା ନାହିଁ। ଏହା ହଟାଯାଇଥାଇପାରେ।" },
    wifeOf: { en: "W/o", or: "ପତି:" }, // REVIEW – see pregnancyList.wifeOf
    age: { en: "Age", or: "ବୟସ" },
    highRiskPrefix: { en: "HIGH RISK:", or: "ଉଚ୍ଚ ବିପଦ:" },
    highRiskFallback: { en: "Requires close monitoring", or: "ନିବିଡ଼ ନଜରଦାରୀ ଆବଶ୍ୟକ" }, // REVIEW
    recordAncVisit: { en: "Record ANC Visit", or: "ANC ପରିଦର୍ଶନ ରେକର୍ଡ କରନ୍ତୁ" },
    registerChild: { en: "Register Child", or: "ଶିଶୁ ପଞ୍ଜୀକରଣ କରନ୍ତୁ" },
    tabVisits: { en: "ANC Visits", or: "ANC ପରିଦର୍ଶନ" },
    tabVaccines: { en: "Immunisation", or: "ଟୀକାକରଣ" },
    tabVitals: { en: "Vitals", or: "ଜୀବନ ସଙ୍କେତ" }, // REVIEW
    noVisits: { en: "No ANC visits recorded yet.", or: "ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ANC ପରିଦର୍ଶନ ରେକର୍ଡ ହୋଇନାହିଁ।" },
    ancVisitNo: { en: "ANC Visit #", or: "ANC ପରିଦର୍ଶନ #" },
    weeksSuffix: { en: "weeks", or: "ସପ୍ତାହ" },
    vBp: { en: "BP", or: "BP" },
    vWeight: { en: "Weight", or: "ଓଜନ" },
    vHb: { en: "Hb", or: "Hb" },
    vFhr: { en: "FHR", or: "FHR" },
    vaccineDemoNote: {
      en: "Sample schedule shown. Confirm against the approved national schedule before clinical use.",
      or: "ନମୁନା ସୂଚୀ ଦେଖାଯାଇଛି। କ୍ଲିନିକାଲ ବ୍ୟବହାର ପୂର୍ବରୁ ଅନୁମୋଦିତ ଜାତୀୟ ସୂଚୀ ସହିତ ମିଳାନ୍ତୁ।", // REVIEW
    },
    doseDuePrefix: { en: "Due", or: "ଦେୟ" },
    markAdministered: { en: "Mark Administered", or: "ଦିଆଯାଇଛି ବୋଲି ଚିହ୍ନଟ କରନ୍ତୁ" }, // REVIEW
    tapToConfirm: { en: "Tap to confirm", or: "ନିଶ୍ଚିତ କରିବାକୁ ଟ୍ୟାପ୍ କରନ୍ତୁ" },
    givenOn: { en: "Given on", or: "ଦିଆଯାଇଥିଲା" },
    batch: { en: "Batch", or: "ବ୍ୟାଚ" },
    gravidaPara: { en: "Gravida / Para", or: "ଗ୍ରାଭିଡା / ପାରା" }, // REVIEW – clinical, kept transliterated
    bloodGroup: { en: "Blood Group", or: "ରକ୍ତ ବର୍ଗ" },
    latestWeight: { en: "Latest Weight", or: "ସର୍ବଶେଷ ଓଜନ" },
    bloodPressure: { en: "Blood Pressure", or: "ରକ୍ତଚାପ" },
    haemoglobin: { en: "Haemoglobin", or: "ହିମୋଗ୍ଲୋବିନ" },
    lmp: { en: "LMP", or: "LMP" },
    registrationDate: { en: "Registration Date", or: "ପଞ୍ଜୀକରଣ ତାରିଖ" },
    existingConditions: { en: "Existing Conditions", or: "ପୂର୍ବରୁ ଥିବା ଅବସ୍ଥା" }, // REVIEW
    allergies: { en: "Allergies", or: "ଆଲର୍ଜି" },
    previousHistory: { en: "Previous History", or: "ପୂର୍ବ ଇତିହାସ" },
    assignedWorker: { en: "Assigned Worker", or: "ନ୍ୟସ୍ତ କର୍ମୀ" },
    none: { en: "None", or: "କିଛି ନାହିଁ" },
    linkedChildren: { en: "Linked Children", or: "ସଂଯୁକ୍ତ ଶିଶୁମାନେ" },
    criticalPregnancy: { en: "Critical Pregnancy", or: "ଗୁରୁତର ଗର୍ଭାବସ୍ଥା" }, // REVIEW
    rcnCardLabel: { en: "RCN Card", or: "RCN କାର୍ଡ" },
    noRcnCard: { en: "No RCN card photo on record.", or: "ରେକର୍ଡରେ କୌଣସି RCN କାର୍ଡ ଫଟୋ ନାହିଁ।" }, // REVIEW
    viewFullSlip: { en: "Tap to view full size", or: "ପୂରା ଆକାରରେ ଦେଖିବାକୁ ଟ୍ୟାପ୍ କରନ୍ତୁ" }, // REVIEW
    flaggedFactors: { en: "Flagged risk factors", or: "ଚିହ୍ନଟ ବିପଦ କାରକ" }, // REVIEW
    noFlaggedFactors: { en: "No risk factors flagged.", or: "କୌଣସି ବିପଦ କାରକ ଚିହ୍ନଟ ହୋଇନାହିଁ।" }, // REVIEW
    delivered: { en: "Delivered", or: "ପ୍ରସବ ହୋଇଛି" }, // REVIEW
    deliveredYes: { en: "Delivered", or: "ପ୍ରସବ ହୋଇଛି" }, // REVIEW
    deliveredNo: { en: "Not delivered", or: "ପ୍ରସବ ହୋଇନାହିଁ" }, // REVIEW
    deliveryDate: { en: "Delivery Date", or: "ପ୍ରସବ ତାରିଖ" },
    deliveryOutcome: { en: "Delivery Outcome", or: "ପ୍ରସବ ପରିଣାମ" }, // REVIEW
    toastAncSaved: { en: "Maternal vaccine marked completed.", or: "ମାତୃ ଟୀକା ସମ୍ପୂର୍ଣ୍ଣ ବୋଲି ଚିହ୍ନଟ ହେଲା।" },
    toastAncFailed: { en: "Failed to update vaccine.", or: "ଟୀକା ଅଦ୍ୟତନ ହୋଇପାରିଲା ନାହିଁ।" },
  },

  alerts: {
    title: { en: "Alert Engine", or: "ସତର୍କତା ଇଞ୍ଜିନ" }, // REVIEW
    segAll: { en: "All Alerts", or: "ସମସ୍ତ ସତର୍କତା" },
    segHighRisk: { en: "High Risk", or: "ଉଚ୍ଚ ବିପଦ" },
    segMissedAnc: { en: "Missed ANC", or: "ଛାଡ଼ିଯାଇଥିବା ANC" }, // REVIEW
    segMaternalVaccine: { en: "Maternal Vaccine", or: "ମାତୃ ଟୀକା" },
    segChildVaccine: { en: "Child Vaccine", or: "ଶିଶୁ ଟୀକା" },
    loading: { en: "Running alert engine batches…", or: "ସତର୍କତା ଇଞ୍ଜିନ ବ୍ୟାଚ ଚାଲୁଛି…" }, // REVIEW
    duePrefix: { en: "Due", or: "ଦେୟ" },
    assignedPrefix: { en: "Assigned:", or: "ନ୍ୟସ୍ତ:" },
    viewRecord: { en: "View Record", or: "ରେକର୍ଡ ଦେଖନ୍ତୁ" },
    acknowledge: { en: "Acknowledge", or: "ସ୍ୱୀକାର କରନ୍ତୁ" },
    tapToConfirm: { en: "Tap to confirm", or: "ନିଶ୍ଚିତ କରିବାକୁ ଟ୍ୟାପ୍ କରନ୍ତୁ" },
    ackedToast: { en: "Alert acknowledged and cleared.", or: "ସତର୍କତା ସ୍ୱୀକୃତ ଏବଂ ସଫା ହେଲା।" },
    viewOnly: { en: "View only", or: "କେବଳ ଦେଖନ୍ତୁ" }, // REVIEW
    ackFailedToast: { en: "Failed to acknowledge alert.", or: "ସତର୍କତା ସ୍ୱୀକାର କରିହେଲା ନାହିଁ।" },
    allClear: { en: "All beneficiary records are up to date. No pending alerts.", or: "ସମସ୍ତ ହିତାଧିକାରୀ ରେକର୍ଡ ଅଦ୍ୟତନ ଅଛି। କୌଣସି ବିଚାରାଧୀନ ସତର୍କତା ନାହିଁ।" }, // REVIEW
    escalationTag: { en: "ESCALATION", or: "ଏସକାଲେସନ" }, // REVIEW
    segEscalations: { en: "Escalations", or: "ଏସକାଲେସନ" }, // REVIEW
  },

  profile: {
    title: { en: "Profile & Settings", or: "ପ୍ରୋଫାଇଲ ଏବଂ ସେଟିଂସ" },
    signedOutToast: { en: "Signed out successfully.", or: "ସଫଳତାର ସହ ସାଇନ ଆଉଟ ହେଲା।" },
    fieldConnectivity: { en: "Field Connectivity", or: "କ୍ଷେତ୍ର ସଂଯୋଗ" }, // REVIEW
    simulatedOffline: { en: "Simulated Offline Mode", or: "ସିମ୍ୟୁଲେଟେଡ ଅଫଲାଇନ ମୋଡ୍" }, // REVIEW
    simulatedOfflineOn: { en: "Records saved locally, will sync when back online.", or: "ରେକର୍ଡ ସ୍ଥାନୀୟ ଭାବେ ସେଭ ହେଲା, ପୁଣି ଅନଲାଇନ ହେଲେ ସିଙ୍କ ହେବ।" }, // REVIEW
    simulatedOfflineOff: { en: "Live connection to central server.", or: "କେନ୍ଦ୍ରୀୟ ସର୍ଭର ସହ ଲାଇଭ ସଂଯୋଗ।" },
    appearance: { en: "Appearance", or: "ଦୃଶ୍ୟ" },
    themeLight: { en: "Light", or: "ଉଜ୍ଜ୍ୱଳ" },
    themeDark: { en: "Dark", or: "ଅନ୍ଧାର" },
    themeSystem: { en: "System", or: "ସିଷ୍ଟମ" },
    appearanceHint: { en: "System follows your device's light/dark setting.", or: "ସିଷ୍ଟମ ଆପଣଙ୍କ ଡିଭାଇସର ଉଜ୍ଜ୍ୱଳ/ଅନ୍ଧାର ସେଟିଂ ଅନୁସରଣ କରେ।" },
    language: { en: "Language", or: "ଭାଷା" },
    langEnglish: { en: "English", or: "English" },
    langOdia: { en: "ଓଡ଼ିଆ", or: "ଓଡ଼ିଆ" },
    languageHint: { en: "Changes all app labels. Names and records stay as recorded.", or: "ସମସ୍ତ ଆପ୍ ଲେବଲ ବଦଳାଏ। ନାମ ଏବଂ ରେକର୍ଡ ଯେପରି ଅଛି ସେହିପରି ରହେ।" }, // REVIEW
    tools: { en: "Tools", or: "ଉପକରଣ" },
    offlineSyncCenter: { en: "Offline Sync Center", or: "ଅଫଲାଇନ ସିଙ୍କ କେନ୍ଦ୍ର" },
    pendingLastSynced: { en: "pending • Last synced", or: "ବିଚାରାଧୀନ • ଶେଷ ସିଙ୍କ" },
    notifications: { en: "Notifications", or: "ବିଜ୍ଞପ୍ତି" },
    notificationsSub: { en: "Campaign & program broadcasts", or: "ଅଭିଯାନ ଏବଂ କାର୍ଯ୍ୟକ୍ରମ ପ୍ରସାରଣ" }, // REVIEW
    assignedVillages: { en: "Assigned Villages", or: "ନ୍ୟସ୍ତ ଗ୍ରାମ" },
    signOut: { en: "Sign Out", or: "ସାଇନ ଆଉଟ" },
  },

  adminDashboard: {
    title: { en: "District Oversight", or: "ଜିଲ୍ଲା ତଦାରଖ" }, // REVIEW
    loading: { en: "Aggregating district analytics…", or: "ଜିଲ୍ଲା ବିଶ୍ଳେଷଣ ସଂଗ୍ରହ ହେଉଛି…" }, // REVIEW
    districtLine: { en: "Jajpur District", or: "ଯାଜପୁର ଜିଲ୍ଲା" },
    blockLine: { en: "Jajpur Sadar & Sukinda Blocks", or: "ଯାଜପୁର ସଦର ଏବଂ ସୁକିନ୍ଦା ବ୍ଲକ" }, // REVIEW
    statusAllClear: { en: "All clear", or: "ସବୁ ଠିକ ଅଛି" }, // REVIEW
    statusNeedsEscalation: { en: "need escalation", or: "ଏସକାଲେସନ ଆବଶ୍ୟକ" }, // REVIEW
    criticalEscalations: { en: "Needs escalation", or: "ଏସକାଲେସନ ଆବଶ୍ୟକ" }, // REVIEW
    noCriticalEscalations: { en: "No active critical pregnancy escalations.", or: "କୌଣସି ସକ୍ରିୟ ଗୁରୁତର ଗର୍ଭାବସ୍ଥା ଏସକାଲେସନ ନାହିଁ।" }, // REVIEW
    allAlerts: { en: "All alerts", or: "ସବୁ ସତର୍କତା" },
    snapshotTitle: { en: "District snapshot", or: "ଜିଲ୍ଲା ସ୍ନାପସଟ" }, // REVIEW
    healthWorkers: { en: "Health Workers", or: "ସ୍ୱାସ୍ଥ୍ୟ କର୍ମୀ" },
    totalPregnancies: { en: "Total Pregnancies", or: "ମୋଟ ଗର୍ଭାବସ୍ଥା" },
    activeLabel: { en: "Active", or: "ସକ୍ରିୟ" },
    highRisk: { en: "High Risk", or: "ଉଚ୍ଚ ବିପଦ" },
    highRiskRate: { en: "High Risk Rate", or: "ଉଚ୍ଚ ବିପଦ ହାର" },
    delivered: { en: "Delivered", or: "ପ୍ରସବ ହୋଇଛି" }, // REVIEW
    totalChildren: { en: "Total Children", or: "ମୋଟ ଶିଶୁ" },
    immCoverage: { en: "Immun. Coverage", or: "ଟୀକାକରଣ ଆଚ୍ଛାଦନ" }, // REVIEW
    districtDetailTitle: { en: "District detail", or: "ଜିଲ୍ଲା ବିବରଣୀ" }, // REVIEW
    byTrimester: { en: "By trimester", or: "ତ୍ରୈମାସିକ ଅନୁଯାୟୀ" }, // REVIEW
    byVillage: { en: "By village", or: "ଗ୍ରାମ ଅନୁଯାୟୀ" }, // REVIEW
    firstTrimester: { en: "1st Trimester", or: "୧ମ ତ୍ରୈମାସିକ" },
    secondTrimester: { en: "2nd Trimester", or: "୨ୟ ତ୍ରୈମାସିକ" },
    thirdTrimester: { en: "3rd Trimester", or: "୩ୟ ତ୍ରୈମାସିକ" },
    fieldTeamTitle: { en: "Field team", or: "ଫିଲ୍ଡ ଟିମ୍" }, // REVIEW
    noActivity: { en: "No activity yet", or: "ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି କାର୍ଯ୍ୟକଳାପ ନାହିଁ" }, // REVIEW
    synced: { en: "Synced", or: "ସିଙ୍କ ହୋଇଛି" },
    wpPregnancies: { en: "Pregnancies", or: "ଗର୍ଭାବସ୍ଥା" },
    wpAncVisits: { en: "ANC Visits", or: "ANC ପରିଦର୍ଶନ" },
    wpChildren: { en: "Children", or: "ଶିଶୁ" },
    notifyTitle: { en: "Notify your team", or: "ଆପଣଙ୍କ ଟିମ୍‌କୁ ସୂଚିତ କରନ୍ତୁ" }, // REVIEW
    notifyBody: {
      en: "Send broadcasts and updates to health workers across the district.",
      or: "ଜିଲ୍ଲାର ସ୍ୱାସ୍ଥ୍ୟ କର୍ମୀମାନଙ୍କୁ ପ୍ରସାରଣ ଏବଂ ଅପଡେଟ ପଠାନ୍ତୁ।", // REVIEW
    },
    openNotifications: { en: "Open Notifications", or: "ବିଜ୍ଞପ୍ତି ଖୋଲନ୍ତୁ" }, // REVIEW
    viewAlerts: { en: "View Alerts", or: "ସତର୍କତା ଦେଖନ୍ତୁ" },
    notifications: { en: "Notifications", or: "ବିଜ୍ଞପ୍ତି" },
    signOut: { en: "Sign Out", or: "ସାଇନ ଆଉଟ" },
    loadFailed: { en: "Failed to load admin KPIs.", or: "ପ୍ରଶାସକ KPI ଲୋଡ୍ ହୋଇପାରିଲା ନାହିଁ।" },
  },

  pmsmaScreen: {
    title: { en: "PMSMA Tracking", or: "PMSMA ଟ୍ରାକିଂ" }, // REVIEW
    subtitle: {
      en: "Free ANC checkup camp, held on the 9th of every month.",
      or: "ମାଗଣା ANC ଯାଞ୍ଚ ଶିବିର, ପ୍ରତି ମାସ ୯ ତାରିଖରେ ଅନୁଷ୍ଠିତ।", // REVIEW
    },
    missedTitle: { en: "Missed this month", or: "ଏହି ମାସ ମିସ୍ ହୋଇଛି" }, // REVIEW
    missedEmpty: { en: "No one has missed this month's camp.", or: "ଏହି ମାସର ଶିବିର କେହି ମିସ୍ କରିନାହାଁନ୍ତି।" }, // REVIEW
    onTrackTitle: { en: "On track", or: "ଠିକ ପଥରେ" }, // REVIEW
    onTrackEmpty: { en: "No active pregnancies on track yet.", or: "ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ସକ୍ରିୟ ଗର୍ଭାବସ୍ଥା ଠିକ ପଥରେ ନାହିଁ।" }, // REVIEW
    notYetChecked: { en: "Not yet checked", or: "ଏପର୍ଯ୍ୟନ୍ତ ଯାଞ୍ଚ ହୋଇନାହିଁ" }, // REVIEW
    lastCheckPrefix: { en: "Last checked:", or: "ଶେଷ ଯାଞ୍ଚ:" }, // REVIEW
    markAttended: { en: "Mark PMSMA Attended", or: "PMSMA ଉପସ୍ଥିତ ଚିହ୍ନଟ କରନ୍ତୁ" }, // REVIEW
    markedToast: { en: "Marked as attended for this month.", or: "ଏହି ମାସ ପାଇଁ ଉପସ୍ଥିତ ବୋଲି ଚିହ୍ନଟ ହେଲା।" }, // REVIEW
    loadFailed: { en: "Failed to load PMSMA tracking.", or: "PMSMA ଟ୍ରାକିଂ ଲୋଡ୍ ହୋଇପାରିଲା ନାହିଁ।" }, // REVIEW
  },

  childrenList: {
    title: { en: "Child Registry", or: "ଶିଶୁ ରେଜିଷ୍ଟ୍ରି" },
    searchPlaceholder: { en: "Search child, mother, ID, village…", or: "ଶିଶୁ, ମାଆ, ID, ଗ୍ରାମ ଖୋଜନ୍ତୁ…" },
    clearFilters: { en: "Clear search & filters", or: "ଖୋଜା ଏବଂ ଫିଲ୍ଟର ସଫା କରନ୍ତୁ" },
    filterAll: { en: "All", or: "ସମସ୍ତ" },
    filterBoys: { en: "Boys", or: "ପୁଅମାନେ" },
    filterGirls: { en: "Girls", or: "ଝିଅମାନେ" },
    countRegistered: { en: "children registered", or: "ଶିଶୁ ପଞ୍ଜୀକୃତ" },
    careOf: { en: "C/o", or: "ମାଆ:" }, // REVIEW – "C/o" = care of mother; Odia shortened to "Mother:" to fit one line
    overdueSuffix: { en: "overdue", or: "ବିଳମ୍ବିତ" },
    vaccinesSuffix: { en: "vaccines", or: "ଟୀକା" },
    birthWt: { en: "birth wt", or: "ଜନ୍ମ ଓଜନ" },
    noneYet: { en: "No children registered yet.", or: "ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ଶିଶୁ ପଞ୍ଜୀକୃତ ନାହିଁ।" },
    noMatch: { en: "No children match this filter.", or: "ଏହି ଫିଲ୍ଟର ସହିତ କୌଣସି ଶିଶୁ ମେଳ ଖାଉନାହାଁନ୍ତି।" },
    registerOne: { en: "Register a child", or: "ଏକ ଶିଶୁ ପଞ୍ଜୀକରଣ କରନ୍ତୁ" },
  },

  // Registration Personal Info — field labels + placeholders wired through i18n.
  regPersonal: {
    sectionTitle: { en: "Personal Information", or: "ବ୍ୟକ୍ତିଗତ ସୂଚନା" },
    rcnId: { en: "RCN ID", or: "RCN ID" },
    phRcnId: { en: "e.g. RCN-2026-00123", or: "ଉଦା. RCN-2026-00123" }, // REVIEW
    fullName: { en: "Full Name", or: "ପୂରା ନାମ" },
    phFullName: { en: "e.g. Sunita Devi", or: "ଉଦା. ସୁନୀତା ଦେବୀ" }, // REVIEW
    husbandName: { en: "Husband's Name", or: "ସ୍ୱାମୀଙ୍କ ନାମ" },
    phHusbandName: { en: "e.g. Rajesh Kumar", or: "ଉଦା. ରାଜେଶ କୁମାର" }, // REVIEW
    age: { en: "Age", or: "ବୟସ" },
    phAge: { en: "24", or: "୨୪" },
    mobile: { en: "Mobile Number", or: "ମୋବାଇଲ ନମ୍ବର" },
    phMobile: { en: "98xxxxxxxx", or: "98xxxxxxxx" },
    village: { en: "Village", or: "ଗ୍ରାମ" },
    phVillage: { en: "e.g. Mangarajpur", or: "ଉଦା. ମାନଗରାଜପୁର" }, // REVIEW
    address: { en: "Address", or: "ଠିକଣା" },
    phAddress: { en: "House no, locality", or: "ଘର ନଂ, ଅଞ୍ଚଳ" }, // REVIEW
    block: { en: "Block", or: "ବ୍ଲକ" },
    phBlock: { en: "e.g. Jajpur Sadar", or: "ଉଦା. ଯାଜପୁର ସଦର" }, // REVIEW
    district: { en: "District", or: "ଜିଲ୍ଲା" },
    phDistrict: { en: "e.g. Jajpur", or: "ଉଦା. ଯାଜପୁର" }, // REVIEW
    bloodGroup: { en: "Blood Group", or: "ରକ୍ତ ବର୍ଗ" },
    gravida: { en: "Gravida", or: "ଗ୍ରାଭିଡା" }, // REVIEW – clinical, kept transliterated
    para: { en: "Para", or: "ପାରା" }, // REVIEW – clinical, kept transliterated
    lmp: { en: "Last Menstrual Period (LMP)", or: "ଶେଷ ଋତୁସ୍ରାବ ତାରିଖ (LMP)" }, // REVIEW
    lmpHint: { en: "EDD & trimester are auto-calculated from LMP.", or: "LMP ରୁ EDD ଓ ତ୍ରୈମାସିକ ସ୍ୱୟଂ ଗଣନା ହୁଏ।" }, // REVIEW
  },

  // "Critical Pregnancy" screening — registration + ANC visit forms. New content
  // only; the pre-existing English field labels on those forms are unchanged.
  riskFactors: {
    rcnCardTitle: { en: "RCN Card", or: "RCN କାର୍ଡ" },
    rcnCardHint: {
      en: "Photograph the mother's ANC/RCN card. Stored on the record; no text is read from it.",
      or: "ମାଆଙ୍କ ANC/RCN କାର୍ଡର ଫଟୋ ନିଅନ୍ତୁ। ରେକର୍ଡରେ ରଖାଯାଏ; କୌଣସି ଲେଖା ପଢ଼ାଯାଏ ନାହିଁ।", // REVIEW
    },
    slipCapture: { en: "Capture / upload card photo", or: "କାର୍ଡ ଫଟୋ ଉଠାନ୍ତୁ / ଅପଲୋଡ କରନ୍ତୁ" }, // REVIEW
    slipCamera: { en: "Take photo", or: "ଫଟୋ ଉଠାନ୍ତୁ" },
    slipGallery: { en: "Choose from gallery", or: "ଗ୍ୟାଲେରୀରୁ ବାଛନ୍ତୁ" }, // REVIEW
    slipChange: { en: "Replace photo", or: "ଫଟୋ ବଦଳାନ୍ତୁ" },
    slipRemove: { en: "Remove", or: "ହଟାନ୍ତୁ" },
    sectionTitle: { en: "High-Risk Pregnancy", or: "ଉଚ୍ଚ ବିପଦଯୁକ୍ତ ଗର୍ଭାବସ୍ଥା" },
    sectionHint: {
      en: "Maternal age is checked automatically below. Tick anything else that applies from the RCN card.",
      or: "ମାତୃ ବୟସ ତଳେ ସ୍ୱୟଂଚାଳିତ ଭାବେ ଯାଞ୍ଚ ହୁଏ। RCN କାର୍ଡରେ ଯାହା ପ୍ରଯୁଜ୍ୟ ତାହା ଟିକ୍ କରନ୍ତୁ।", // REVIEW
    },
    autoTitle: { en: "Other auto-detected", or: "ଅନ୍ୟ ସ୍ୱୟଂ-ଚିହ୍ନଟ" }, // REVIEW
    autoNone: { en: "None from gravida or blood group.", or: "ଗ୍ରାଭିଡା କିମ୍ବା ରକ୍ତ ବର୍ଗରୁ କିଛି ନାହିଁ।" }, // REVIEW

    // 1. Maternal Age — fully auto-detected from the Age field, no checkbox.
    maternalAgeTitle: { en: "Maternal Age", or: "ମାତୃ ବୟସ" },
    maternalAgeHint: { en: "Auto-detected from the Age field above.", or: "ଉପରେ ଥିବା ବୟସ ଫିଲ୍ଡରୁ ସ୍ୱୟଂ-ଚିହ୍ନଟ ହୁଏ।" }, // REVIEW
    autoTag: { en: "Detected", or: "ଚିହ୍ନଟ ହୋଇଛି" }, // REVIEW
    ageUnder18: { en: "< 18 years", or: "୧୮ ବର୍ଷରୁ କମ" },
    age35Plus: { en: "≥ 35 years (especially first pregnancy)", or: "୩୫ ବର୍ଷ କିମ୍ବା ଅଧିକ (ବିଶେଷତଃ ପ୍ରଥମ ଗର୍ଭାବସ୍ଥା)" },
    age40Plus: { en: "≥ 40 years", or: "୪୦ ବର୍ଷ କିମ୍ବା ଅଧିକ" },

    // 2. Previous Obstetric History
    obHistoryTitle: { en: "Previous Obstetric History", or: "ପୂର୍ବ ପ୍ରସୂତି ଇତିହାସ" },
    obPrevCSection: { en: "Previous caesarean section or uterine surgery", or: "ପୂର୍ବ ସିଜେରିଆନ ଅସ୍ତ୍ରୋପଚାର କିମ୍ବା ଗର୍ଭାଶୟ ଅସ୍ତ୍ରୋପଚାର" },
    obPrevStillbirth: { en: "Previous stillbirth/neonatal death", or: "ପୂର୍ବ ମୃତ ଜନ୍ମ / ନବଜାତ ମୃତ୍ୟୁ" },
    obPrevPreterm: { en: "Previous preterm birth", or: "ପୂର୍ବ ଅକାଳ ଜନ୍ମ" },
    obPrevRecurrentAbortion: { en: "Previous recurrent abortions", or: "ପୂର୍ବ ବାରମ୍ବାର ଗର୍ଭପାତ" },
    obPrevCongenitalAnomaly: { en: "Previous baby with congenital anomaly", or: "ପୂର୍ବ ଜନ୍ମଗତ ତ୍ରୁଟିଯୁକ୍ତ ଶିଶୁ" },
    obPrevPph: { en: "Previous PPH or severe obstetric complication", or: "ପୂର୍ବ ପ୍ରସବ ପରବର୍ତ୍ତୀ ରକ୍ତସ୍ରାବ (PPH) କିମ୍ବା ଗୁରୁତର ପ୍ରସୂତି ଜଟିଳତା" },
    obPrevSeverePreeclampsia: { en: "Previous severe pre-eclampsia/eclampsia", or: "ପୂର୍ବ ଗୁରୁତର ପ୍ରି-ଏକ୍ଲାମସିଆ/ଏକ୍ଲାମସିଆ" },

    // 3. Current Pregnancy Complications
    complicationsTitle: { en: "Current Pregnancy Complications", or: "ବର୍ତ୍ତମାନ ଗର୍ଭାବସ୍ଥା ଜଟିଳତା" },
    ccHypertension: { en: "Hypertension / pre-eclampsia / eclampsia", or: "ଉଚ୍ଚ ରକ୍ତଚାପ / ପ୍ରି-ଏକ୍ଲାମସିଆ / ଏକ୍ଲାମସିଆ" },
    ccDiabetes: { en: "Gestational or pre-existing diabetes", or: "ଗର୍ଭାବସ୍ଥା ମଧୁମେହ କିମ୍ବା ପୂର୍ବରୁ ଥିବା ମଧୁମେହ" },
    ccAnaemia: { en: "Anaemia, especially severe", or: "ରକ୍ତହୀନତା, ବିଶେଷତଃ ଗୁରୁତର ରକ୍ତହୀନତା" },
    ccAph: { en: "Antepartum haemorrhage", or: "ପ୍ରସବ ପୂର୍ବ ରକ୍ତସ୍ରାବ" },
    ccMultiple: { en: "Multiple pregnancy (twins/triplets)", or: "ବହୁଗର୍ଭ (ଯାଆଁଳା/ତିନି ଯାଆଁଳା)" },
    ccMalpresentation: { en: "Malpresentation", or: "ଅସାମାନ୍ୟ ଗର୍ଭସ୍ଥ ଶିଶୁ ଅବସ୍ଥାନ" },
    ccPlacentaPrevia: { en: "Placenta previa/accreta", or: "ପ୍ଲାସେଣ୍ଟା ପ୍ରିଭିଆ/ଏକ୍ରିଟା" },
    ccFgr: { en: "Fetal growth restriction", or: "ଗର୍ଭସ୍ଥ ଶିଶୁ ବୃଦ୍ଧି ସୀମିତତା" },
    ccRh: { en: "Rh isoimmunisation", or: "Rh ଆଇସୋଇମ୍ୟୁନାଇଜେସନ" },
    ccAmnioticFluid: { en: "Oligohydramnios/polyhydramnios", or: "ଆମ୍ନିଓଟିକ ତରଳ ପଦାର୍ଥ କମ/ଅଧିକ" },
    ccCongenitalFetal: { en: "Congenital fetal anomaly", or: "ଜନ୍ମଗତ ଗର୍ଭସ୍ଥ ଶିଶୁ ତ୍ରୁଟି" },

    // 4. Maternal Medical Conditions (shares the comorbidities array with cmDiabetes etc. below)
    medicalTitle: { en: "Maternal Medical Conditions", or: "ମାତୃ ଚିକିତ୍ସା ଅବସ୍ଥା" },
    mcHeart: { en: "Heart disease", or: "ହୃଦ୍‌ରୋଗ" },
    mcKidney: { en: "Kidney disease", or: "କିଡନୀ ରୋଗ" },
    mcThyroid: { en: "Thyroid disease", or: "ଥାଇରଏଡ ରୋଗ" },
    mcEpilepsy: { en: "Epilepsy", or: "ମୃଗୀ ରୋଗ" },
    mcRespiratory: { en: "Severe respiratory disease", or: "ଗୁରୁତର ଶ୍ୱାସକ୍ରିୟା ରୋଗ" },
    mcAutoimmune: { en: "Autoimmune disorders", or: "ଅଟୋଇମ୍ୟୁନ ବ୍ୟାଧି" },
    mcHiv: { en: "HIV or other significant infections", or: "HIV କିମ୍ବା ଅନ୍ୟ ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ ସଂକ୍ରମଣ" },
    mcTb: { en: "Tuberculosis or other serious systemic illness", or: "ଯକ୍ଷ୍ମା କିମ୍ବା ଅନ୍ୟ ଗୁରୁତର ପ୍ରଣାଳୀଗତ ରୋଗ" },

    // 5. Pregnancy-Related Factors
    pregRelatedTitle: { en: "Pregnancy-Related Factors", or: "ଗର୍ଭାବସ୍ଥା ସମ୍ବନ୍ଧୀୟ କାରକ" },
    prBmi: { en: "Very low/high BMI", or: "ଅତି କମ/ଅଧିକ BMI" },
    prNutrition: { en: "Poor nutritional status", or: "ଦୁର୍ବଳ ପୋଷଣ ସ୍ଥିତି" },
    prAntenatalCare: { en: "Poor antenatal care", or: "ଦୁର୍ବଳ ପ୍ରସବ ପୂର୍ବ ଯତ୍ନ" },
    prPostTerm: { en: "Post-term pregnancy (≥41 weeks)", or: "ନିର୍ଦ୍ଧାରିତ ସମୟ ପରେ ଗର୍ଭାବସ୍ଥା (୪୧ ସପ୍ତାହ କିମ୍ବା ଅଧିକ)" },
    prProlongedRom: { en: "Prolonged rupture of membranes", or: "ଦୀର୍ଘସ୍ଥାୟୀ ଝିଲ୍ଲୀ ଫାଟିବା" },
    prOtherLabel: { en: "Other significant obstetric/fetal abnormalities", or: "ଅନ୍ୟ ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ ପ୍ରସୂତି କିମ୍ବା ଗର୍ଭସ୍ଥ ଶିଶୁ ଅସ୍ୱାଭାବିକତା" },
    prOtherPlaceholder: { en: "Describe...", or: "ବର୍ଣ୍ଣନା କରନ୍ତୁ..." }, // REVIEW
    teenageOverlapNote: {
      en: "Teenage pregnancy is tracked under Maternal Age (< 18 years) above — not repeated here.",
      or: "କିଶୋରୀ ଗର୍ଭାବସ୍ଥା ଉପରେ ଥିବା ମାତୃ ବୟସ (୧୮ ବର୍ଷରୁ କମ) ଅଧୀନରେ ଟ୍ରାକ୍ ହୁଏ — ଏଠାରେ ପୁନରାବୃତ୍ତି ହୁଏ ନାହିଁ।", // REVIEW
    },

    shortStature: { en: "Short stature (height < 145 cm)", or: "କମ୍ ଉଚ୍ଚତା (ଉଚ୍ଚତା < ୧୪୫ ସେମି)" }, // REVIEW
    hypertension: { en: "Hypertension (BP ≥ 140/90)", or: "ଉଚ୍ଚ ରକ୍ତଚାପ (BP ≥ ୧୪୦/୯୦)" }, // REVIEW
    severeAnaemia: { en: "Severe anaemia (Hb < 7 g/dL)", or: "ଗମ୍ଭୀର ରକ୍ତହୀନତା (Hb < ୭ g/dL)" }, // REVIEW
    bmiAbnormal: { en: "Underweight or obese (BMI outside normal)", or: "କମ୍ ଓଜନ କିମ୍ବା ମୋଟାପଣ (BMI ସାଧାରଣ ବାହାରେ)" }, // REVIEW
    prevCSection: { en: "Previous caesarean section", or: "ପୂର୍ବ ସିଜେରିଆନ ପ୍ରସବ" }, // REVIEW
    prevStillbirthPph: {
      en: "Previous stillbirth or postpartum haemorrhage (PPH)",
      or: "ପୂର୍ବ ମୃତ ଶିଶୁ ଜନ୍ମ କିମ୍ବା ପ୍ରସବ ପରବର୍ତ୍ତୀ ରକ୍ତସ୍ରାବ (PPH)", // REVIEW
    },
    multipleGestation: { en: "Multiple gestation (twins or more)", or: "ଏକାଧିକ ଗର୍ଭ (ଯାଆଁଳା କିମ୍ବା ଅଧିକ)" }, // REVIEW
    comorbiditiesLabel: { en: "Known comorbidities", or: "ଜଣାଶୁଣା ସହ-ରୋଗ" }, // REVIEW
    cmDiabetes: { en: "Diabetes", or: "ମଧୁମେହ" }, // REVIEW
    cmCardiac: { en: "Cardiac disease", or: "ହୃଦ୍‌ରୋଗ" }, // REVIEW
    cmThyroid: { en: "Thyroid disorder", or: "ଥାଇରଏଡ ବିକାର" }, // REVIEW
    cmEpilepsy: { en: "Epilepsy", or: "ମୃଗୀ" }, // REVIEW
    cmKidney: { en: "Kidney disease", or: "ବୃକକ୍ ରୋଗ" }, // REVIEW
    cmTb: { en: "TB", or: "ଯକ୍ଷ୍ମା (TB)" }, // REVIEW
    cmHiv: { en: "HIV", or: "HIV" },
    clinicianOverride: { en: "Clinician override — mark as Critical", or: "ଚିକିତ୍ସକ ନିର୍ଣ୍ଣୟ — ଗୁରୁତର ବୋଲି ଚିହ୍ନଟ କରନ୍ତୁ" }, // REVIEW
    criticalYes: { en: "Critical Pregnancy: YES", or: "ଗୁରୁତର ଗର୍ଭାବସ୍ଥା: ହଁ" }, // REVIEW
    criticalNo: { en: "Not currently critical", or: "ବର୍ତ୍ତମାନ ଗୁରୁତର ନୁହେଁ" }, // REVIEW
    triggeredBy: { en: "Triggered by:", or: "କାରଣ:" }, // REVIEW
    ancNewlyIdentified: { en: "Newly identified risk factors", or: "ନୂତନ ଭାବେ ଚିହ୍ନଟ ବିପଦ କାରକ" }, // REVIEW
    ancInfo: {
      en: "Tick any risk factor identified at this visit. Any one — here or already on record — keeps this pregnancy Critical and raises an escalation.",
      or: "ଏହି ପରିଦର୍ଶନରେ ଚିହ୍ନଟ ହୋଇଥିବା ବିପଦ କାରକ ଟିକ୍ କରନ୍ତୁ। ଗୋଟିଏ ବି — ଏଠାରେ କିମ୍ବା ପୂର୍ବରୁ ରେକର୍ଡରେ — ଏହି ଗର୍ଭାବସ୍ଥାକୁ ଗୁରୁତର ରଖି ଏସକାଲେସନ ଉଠାଏ।", // REVIEW
    },
  },
} as const;

// --- data-enum display mappers (data stays English; only the label changes) ---

/** Map a stored status string ("Overdue", "Trimester 2", "high_risk"…) to the
 *  active language. Unknown values pass through unchanged. */
export function statusLabel(raw: string, tr: Translations): string {
  const n = (raw || "").toLowerCase().trim();
  if (n.includes("complet") || n.includes("done")) return tr.status.completed;
  if (n.includes("overdue")) return tr.status.overdue;
  if (n.includes("upcoming")) return tr.status.upcoming;
  if (n.includes("scheduled")) return tr.status.scheduled;
  if (n.includes("due")) return tr.status.due;
  if (n.includes("high risk") || n === "high_risk") return tr.status.highRisk;
  if (n.includes("deliver")) return tr.status.delivered;
  if (n.includes("normal")) return tr.status.normal;
  if (n === "active") return tr.status.active;
  const trim = raw.match(/^Trimester\s+([1-3])$/i);
  if (trim) return trimesterLabel(Number(trim[1]), tr);
  return raw;
}

export function trimesterLabel(n: number, tr: Translations): string {
  const map: Record<number, string> = {
    1: tr.adminDashboard.firstTrimester,
    2: tr.adminDashboard.secondTrimester,
    3: tr.adminDashboard.thirdTrimester,
  };
  return map[n] || `Trimester ${n}`;
}

export function priorityLabel(raw: string, tr: Translations): string {
  const key = (raw || "").toUpperCase() as keyof Translations["priority"];
  return tr.priority[key] || raw;
}
