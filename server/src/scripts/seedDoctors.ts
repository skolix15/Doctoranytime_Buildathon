import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://admin:vamos@localhost:27017/BuildathonDB?authSource=admin';

const DoctorSchema = new mongoose.Schema({}, { strict: false });
const Doctor = mongoose.model('Doctor', DoctorSchema);
const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', UserSchema);

const specialties = [
  'Καρδιολογία', 'Ορθοπεδική', 'Δερματολογία', 'Παιδιατρική',
  'Νευρολογία', 'Ενδοκρινολογία', 'Γαστρεντερολογία', 'Πνευμονολογία',
  'Ουρολογία', 'Οφθαλμολογία', 'ΩΡΛ', 'Μαιευτική/Γυναικολογία',
  'Ψυχιατρική', 'Αλλεργιολογία', 'Ρευματολογία', 'Αγγειοχειρουργική',
  'Νεφρολογία', 'Αιματολογία', 'Ογκολογία', 'Γενική Ιατρική'
];

const locations = [
  { name: 'Ιατρείο Αθηνών Κέντρο', address: 'Βασ. Σοφίας 80, Αθήνα', city: 'Αθήνα', coords: { lat: 37.977, lng: 23.749 } },
  { name: 'Ιατρείο Κολωνάκι', address: 'Σκουφά 45, Αθήνα', city: 'Αθήνα', coords: { lat: 37.979, lng: 23.743 } },
  { name: 'Ιατρείο Γλυφάδας', address: 'Λεωφ. Βουλιαγμένης 110, Γλυφάδα', city: 'Γλυφάδα', coords: { lat: 37.868, lng: 23.754 } },
  { name: 'Ιατρείο Θεσσαλονίκης', address: 'Τσιμισκή 52, Θεσσαλονίκη', city: 'Θεσσαλονίκη', coords: { lat: 40.634, lng: 22.943 } },
  { name: 'Ιατρείο Πειραιά', address: 'Ηρώων Πολυτεχνείου 20, Πειραιάς', city: 'Πειραιάς', coords: { lat: 37.944, lng: 23.644 } },
  { name: 'Ιατρείο Μαρουσίου', address: 'Κηφισίας 100, Μαρούσι', city: 'Μαρούσι', coords: { lat: 38.049, lng: 23.807 } },
  { name: 'Ιατρείο Χαλανδρίου', address: 'Αγ. Παρασκευής 60, Χαλάνδρι', city: 'Χαλάνδρι', coords: { lat: 38.019, lng: 23.797 } },
  { name: 'Ιατρείο Πατρών', address: 'Κορίνθου 80, Πάτρα', city: 'Πάτρα', coords: { lat: 38.246, lng: 21.736 } },
];

const insurances = ['ΙΚΑ/ΕΦΚΑ', 'ΕΟΠΥΥ', 'ΕΛΠ', 'Generali', 'Allianz', 'AXA', 'Groupama', 'Interamerican', 'Ιδιώτες'];

interface DoctorDef {
  firstName: string;
  lastName: string;
  specialty: string;
  bio: string;
  experience: number;
  rating: number;
  reviewCount: number;
  consultationFee: number;
  locationIdx: number;
  languages: string[];
  services: string[];
  insurance: string[];
  education: { degree: string; institution: string; year: number }[];
}

const doctorDefs: DoctorDef[] = [
  // Cardiology
  {
    firstName: 'Δημήτριος', lastName: 'Παπαδόπουλος', specialty: 'Καρδιολογία',
    bio: 'Εξειδικευμένος καρδιολόγος με 20 χρόνια εμπειρία στη θεραπεία καρδιαγγειακών νοσημάτων. Πρώην διευθυντής καρδιολογικής κλινικής Ευαγγελισμού.',
    experience: 20, rating: 4.9, reviewCount: 312, consultationFee: 120, locationIdx: 0,
    languages: ['Ελληνικά', 'Αγγλικά'],
    services: ['Καρδιολογία', 'Ηλεκτροκαρδιογράφημα', 'Holter', 'Υπέρηχος καρδιάς', 'Τεστ κοπώσεως'],
    insurance: ['ΕΟΠΥΥ', 'ΙΚΑ/ΕΦΚΑ', 'Generali', 'Allianz', 'Ιδιώτες'],
    education: [
      { degree: 'Ιατρική', institution: 'Εθνικό Καποδιστριακό Πανεπιστήμιο Αθηνών', year: 1998 },
      { degree: 'Ειδίκευση Καρδιολογίας', institution: 'Νοσοκομείο Ευαγγελισμός', year: 2004 },
      { degree: 'PhD Καρδιαγγειακή Ιατρική', institution: 'ΕΚΠΑ', year: 2007 }
    ]
  },
  {
    firstName: 'Ελένη', lastName: 'Αλεξανδράκη', specialty: 'Καρδιολογία',
    bio: 'Καρδιολόγος με εξειδίκευση στη γυναικεία καρδιολογία και στα μεταβολικά σύνδρομα. Διδάκτωρ Πανεπιστημίου Αθηνών.',
    experience: 14, rating: 4.8, reviewCount: 198, consultationFee: 100, locationIdx: 1,
    languages: ['Ελληνικά', 'Αγγλικά', 'Γαλλικά'],
    services: ['Καρδιολογία', 'Υπέρηχος καρδιάς', 'Holter πίεσης', 'Γυναικεία καρδιολογία'],
    insurance: ['ΕΟΠΥΥ', 'AXA', 'Interamerican', 'Ιδιώτες'],
    education: [
      { degree: 'Ιατρική', institution: 'ΕΚΠΑ', year: 2004 },
      { degree: 'Ειδίκευση Καρδιολογίας', institution: 'Ιπποκράτειο Νοσοκομείο', year: 2010 }
    ]
  },
  // Pediatrics
  {
    firstName: 'Σοφία', lastName: 'Νικολάου', specialty: 'Παιδιατρική',
    bio: 'Παιδίατρος με εξειδίκευση στη νεογνολογία και την αναπτυξιακή παιδιατρική. 16 χρόνια εμπειρία σε παιδιατρικά τμήματα.',
    experience: 16, rating: 4.9, reviewCount: 445, consultationFee: 80, locationIdx: 0,
    languages: ['Ελληνικά', 'Αγγλικά'],
    services: ['Παιδιατρική', 'Εμβολιασμοί', 'Αναπτυξιολογικός έλεγχος', 'Νεογνολογία', 'Εφηβική ιατρική'],
    insurance: ['ΕΟΠΥΥ', 'ΙΚΑ/ΕΦΚΑ', 'Groupama', 'Allianz', 'Ιδιώτες'],
    education: [
      { degree: 'Ιατρική', institution: 'ΕΚΠΑ', year: 2002 },
      { degree: 'Ειδίκευση Παιδιατρικής', institution: 'Παιδιατρικό Νοσοκομείο «Αγία Σοφία»', year: 2008 }
    ]
  },
  {
    firstName: 'Ανδρέας', lastName: 'Κωστόπουλος', specialty: 'Παιδιατρική',
    bio: 'Παιδίατρος με εξειδίκευση στις αλλεργίες και το άσθμα στα παιδιά. Συνεργάτης κλινικών αριστείας Αττικής.',
    experience: 11, rating: 4.7, reviewCount: 267, consultationFee: 75, locationIdx: 6,
    languages: ['Ελληνικά', 'Αγγλικά', 'Γερμανικά'],
    services: ['Παιδιατρική', 'Παιδικές αλλεργίες', 'Παιδικό άσθμα', 'Εμβολιασμοί'],
    insurance: ['ΕΟΠΥΥ', 'ΕΛΠ', 'Interamerican', 'Ιδιώτες'],
    education: [
      { degree: 'Ιατρική', institution: 'Αριστοτέλειο Πανεπιστήμιο Θεσσαλονίκης', year: 2007 },
      { degree: 'Ειδίκευση Παιδιατρικής', institution: 'Νοσοκομείο Παίδων «Π. & Α. Κυριακού»', year: 2013 }
    ]
  },
  // Dermatology
  {
    firstName: 'Μαρία', lastName: 'Ζαχαριάδου', specialty: 'Δερματολογία',
    bio: 'Δερματολόγος-Αφροδισιολόγος με ειδίκευση στην κοσμητική δερματολογία και τη θεραπεία δερματικών παθήσεων. Laser specialist.',
    experience: 12, rating: 4.8, reviewCount: 389, consultationFee: 90, locationIdx: 1,
    languages: ['Ελληνικά', 'Αγγλικά', 'Ιταλικά'],
    services: ['Δερματολογία', 'Κοσμητική δερματολογία', 'Laser αποτρίχωση', 'Ακμή', 'Ψωρίαση', 'Δερμοσκόπηση σπίλων'],
    insurance: ['ΕΟΠΥΥ', 'Generali', 'AXA', 'Ιδιώτες'],
    education: [
      { degree: 'Ιατρική', institution: 'ΕΚΠΑ', year: 2006 },
      { degree: 'Ειδίκευση Δερματολογίας', institution: 'Νοσοκομείο Α. Συγγρός', year: 2012 }
    ]
  },
  // Endocrinology
  {
    firstName: 'Κωνσταντίνος', lastName: 'Μαυρίδης', specialty: 'Ενδοκρινολογία',
    bio: 'Ενδοκρινολόγος με εξειδίκευση στον σακχαρώδη διαβήτη, την παχυσαρκία και τις διαταραχές θυρεοειδούς.',
    experience: 18, rating: 4.9, reviewCount: 521, consultationFee: 110, locationIdx: 0,
    languages: ['Ελληνικά', 'Αγγλικά'],
    services: ['Ενδοκρινολογία', 'Διαβήτης τύπου 1 & 2', 'Θυρεοειδής', 'Παχυσαρκία', 'Οστεοπόρωση', 'Υπόφυση'],
    insurance: ['ΕΟΠΥΥ', 'ΙΚΑ/ΕΦΚΑ', 'Allianz', 'Groupama', 'Ιδιώτες'],
    education: [
      { degree: 'Ιατρική', institution: 'ΕΚΠΑ', year: 2000 },
      { degree: 'Ειδίκευση Ενδοκρινολογίας', institution: 'Νοσοκομείο Λαϊκό', year: 2006 },
      { degree: 'Fellowship Διαβήτης', institution: 'Joslin Diabetes Center, Boston', year: 2008 }
    ]
  },
  // Neurology
  {
    firstName: 'Χριστίνα', lastName: 'Παπαγεωργίου', specialty: 'Νευρολογία',
    bio: 'Νευρολόγος με εξειδίκευση στις κεφαλαλγίες, το εγκεφαλικό επεισόδιο και τη νόσο Parkinson.',
    experience: 15, rating: 4.7, reviewCount: 234, consultationFee: 110, locationIdx: 5,
    languages: ['Ελληνικά', 'Αγγλικά'],
    services: ['Νευρολογία', 'Κεφαλαλγία/Ημικρανία', 'Επιληψία', 'Parkinson', 'Σκλήρυνση κατά πλάκας', 'ΗΕΓ'],
    insurance: ['ΕΟΠΥΥ', 'ΕΛΠ', 'AXA', 'Interamerican', 'Ιδιώτες'],
    education: [
      { degree: 'Ιατρική', institution: 'ΕΚΠΑ', year: 2003 },
      { degree: 'Ειδίκευση Νευρολογίας', institution: 'Νοσοκομείο Αιγινήτειο', year: 2009 }
    ]
  },
  // Gastroenterology
  {
    firstName: 'Νικόλαος', lastName: 'Σταματίου', specialty: 'Γαστρεντερολογία',
    bio: 'Γαστρεντερολόγος-Ηπατολόγος με εμπειρία σε γαστροσκοπήσεις, κολοσκοπήσεις και φλεγμονώδη νοσήματα εντέρου.',
    experience: 13, rating: 4.8, reviewCount: 302, consultationFee: 100, locationIdx: 2,
    languages: ['Ελληνικά', 'Αγγλικά'],
    services: ['Γαστρεντερολογία', 'Γαστροσκόπηση', 'Κολοσκόπηση', 'GERD', 'Ευερέθιστο έντερο', 'Ηπατολογία'],
    insurance: ['ΕΟΠΥΥ', 'ΙΚΑ/ΕΦΚΑ', 'Generali', 'Allianz', 'Ιδιώτες'],
    education: [
      { degree: 'Ιατρική', institution: 'Πανεπιστήμιο Πατρών', year: 2005 },
      { degree: 'Ειδίκευση Γαστρεντερολογίας', institution: 'Νοσοκομείο Σωτηρία', year: 2011 }
    ]
  },
  // Orthopedics
  {
    firstName: 'Γεώργιος', lastName: 'Λεβέντης', specialty: 'Ορθοπεδική',
    bio: 'Ορθοπεδικός χειρουργός με εξειδίκευση στην αρθροσκοπική χειρουργική γόνατος και ώμου, αθλητικές κακώσεις.',
    experience: 17, rating: 4.9, reviewCount: 478, consultationFee: 120, locationIdx: 0,
    languages: ['Ελληνικά', 'Αγγλικά', 'Γερμανικά'],
    services: ['Ορθοπεδική', 'Αρθροσκόπηση γόνατος', 'Αρθροσκόπηση ώμου', 'Αθλητικές κακώσεις', 'Αντικατάσταση ισχίου', 'Σπονδυλική στήλη'],
    insurance: ['ΕΟΠΥΥ', 'ΙΚΑ/ΕΦΚΑ', 'Interamerican', 'AXA', 'Ιδιώτες'],
    education: [
      { degree: 'Ιατρική', institution: 'ΕΚΠΑ', year: 2001 },
      { degree: 'Ειδίκευση Ορθοπεδικής', institution: 'ΚΑΤ Νοσοκομείο', year: 2007 },
      { degree: 'Fellowship Αθλητική Χειρουργική', institution: 'Charité Berlin', year: 2009 }
    ]
  },
  // Pulmonology
  {
    firstName: 'Αικατερίνη', lastName: 'Βλαχοπούλου', specialty: 'Πνευμονολογία',
    bio: 'Πνευμονολόγος-Φυματιολόγος με εξειδίκευση στο άσθμα, τη ΧΑΠ και τις διάμεσες πνευμονοπάθειες.',
    experience: 14, rating: 4.7, reviewCount: 189, consultationFee: 90, locationIdx: 3,
    languages: ['Ελληνικά', 'Αγγλικά'],
    services: ['Πνευμονολογία', 'Άσθμα', 'ΧΑΠ', 'Σπιρομέτρηση', 'Αποφρακτική άπνοια ύπνου', 'Πολυσωμνογραφία'],
    insurance: ['ΕΟΠΥΥ', 'ΙΚΑ/ΕΦΚΑ', 'Groupama', 'Ιδιώτες'],
    education: [
      { degree: 'Ιατρική', institution: 'ΑΠΘ', year: 2004 },
      { degree: 'Ειδίκευση Πνευμονολογίας', institution: 'Νοσοκομείο Σωτηρία', year: 2010 }
    ]
  },
  // Urology
  {
    firstName: 'Ιωάννης', lastName: 'Τριανταφύλλου', specialty: 'Ουρολογία',
    bio: 'Ουρολόγος-Ανδρολόγος με εμπειρία σε λαπαροσκοπικές επεμβάσεις, λιθοτριψία και θεραπεία καρκίνου προστάτη.',
    experience: 19, rating: 4.8, reviewCount: 356, consultationFee: 100, locationIdx: 0,
    languages: ['Ελληνικά', 'Αγγλικά'],
    services: ['Ουρολογία', 'Ανδρολογία', 'Καρκίνος προστάτη', 'Λιθίαση', 'Εκτομή εν μεγέθει', 'Λαπαροσκόπηση'],
    insurance: ['ΕΟΠΥΥ', 'ΙΚΑ/ΕΦΚΑ', 'AXA', 'Allianz', 'Ιδιώτες'],
    education: [
      { degree: 'Ιατρική', institution: 'ΕΚΠΑ', year: 1999 },
      { degree: 'Ειδίκευση Ουρολογίας', institution: 'Νοσοκομείο Λαϊκό', year: 2005 }
    ]
  },
  // Ophthalmology
  {
    firstName: 'Παναγιώτα', lastName: 'Δημητρίου', specialty: 'Οφθαλμολογία',
    bio: 'Οφθαλμολόγος με εξειδίκευση στη διαθλαστική χειρουργική, τον καταρράκτη και τον αμφιβληστροειδή.',
    experience: 16, rating: 4.9, reviewCount: 412, consultationFee: 90, locationIdx: 1,
    languages: ['Ελληνικά', 'Αγγλικά', 'Ισπανικά'],
    services: ['Οφθαλμολογία', 'LASIK', 'Καταρράκτης', 'Αμφιβληστροειδής', 'Γλαύκωμα', 'Βυθοσκόπηση'],
    insurance: ['ΕΟΠΥΥ', 'ΙΚΑ/ΕΦΚΑ', 'Interamerican', 'Generali', 'Ιδιώτες'],
    education: [
      { degree: 'Ιατρική', institution: 'ΕΚΠΑ', year: 2002 },
      { degree: 'Ειδίκευση Οφθαλμολογίας', institution: 'Νοσοκομείο Γ. Γεννηματάς', year: 2008 }
    ]
  },
  // ENT
  {
    firstName: 'Βασίλειος', lastName: 'Κοντός', specialty: 'ΩΡΛ',
    bio: 'ΩΡΛ-χειρουργός με εξειδίκευση στις χρόνιες παθήσεις ρινός-παραρρίνιων και την απώλεια ακοής.',
    experience: 12, rating: 4.7, reviewCount: 278, consultationFee: 85, locationIdx: 4,
    languages: ['Ελληνικά', 'Αγγλικά'],
    services: ['ΩΡΛ', 'Ρινοσκόπηση', 'Ακοολογία', 'Βαρηκοΐα', 'Αμυγδαλές', 'Ιγμορίτιδα', 'Ροχαλητό'],
    insurance: ['ΕΟΠΥΥ', 'ΙΚΑ/ΕΦΚΑ', 'Groupama', 'Ιδιώτες'],
    education: [
      { degree: 'Ιατρική', institution: 'ΑΠΘ', year: 2006 },
      { degree: 'Ειδίκευση ΩΡΛ', institution: 'Νοσοκομείο ΑΧΕΠΑ', year: 2012 }
    ]
  },
  // Gynecology
  {
    firstName: 'Σταυρούλα', lastName: 'Κανελλοπούλου', specialty: 'Μαιευτική/Γυναικολογία',
    bio: 'Μαιευτήρας-Γυναικολόγος με εξειδίκευση στην υποβοηθούμενη αναπαραγωγή και τη λαπαροσκοπική χειρουργική.',
    experience: 20, rating: 4.9, reviewCount: 589, consultationFee: 110, locationIdx: 0,
    languages: ['Ελληνικά', 'Αγγλικά', 'Γαλλικά'],
    services: ['Γυναικολογία', 'Μαιευτική', 'Εξωσωματική γονιμοποίηση', 'Κολποσκόπηση', 'Υστεροσκόπηση', 'Λαπαροσκόπηση'],
    insurance: ['ΕΟΠΥΥ', 'ΙΚΑ/ΕΦΚΑ', 'AXA', 'Allianz', 'Interamerican', 'Ιδιώτες'],
    education: [
      { degree: 'Ιατρική', institution: 'ΕΚΠΑ', year: 1998 },
      { degree: 'Ειδίκευση Μαιευτικής-Γυναικολογίας', institution: 'Νοσοκομείο Μαιευτήριο Ελενα Βενιζέλου', year: 2004 }
    ]
  },
  // Psychiatry
  {
    firstName: 'Αλέξανδρος', lastName: 'Κυριάκης', specialty: 'Ψυχιατρική',
    bio: 'Ψυχίατρος με εξειδίκευση στις διαταραχές διάθεσης, αγχώδεις διαταραχές και γνωσιακή-συμπεριφορική θεραπεία.',
    experience: 15, rating: 4.8, reviewCount: 341, consultationFee: 100, locationIdx: 1,
    languages: ['Ελληνικά', 'Αγγλικά'],
    services: ['Ψυχιατρική', 'Κατάθλιψη', 'Αγχώδεις διαταραχές', 'Διπολική διαταραχή', 'CBT', 'PTSD'],
    insurance: ['ΕΟΠΥΥ', 'Ιδιώτες', 'AXA'],
    education: [
      { degree: 'Ιατρική', institution: 'ΕΚΠΑ', year: 2003 },
      { degree: 'Ειδίκευση Ψυχιατρικής', institution: 'Νοσοκομείο Αιγινήτειο', year: 2009 }
    ]
  },
  // Allergology
  {
    firstName: 'Ρεγγίνα', lastName: 'Μπουρτζή', specialty: 'Αλλεργιολογία',
    bio: 'Αλλεργιολόγος-Κλινική Ανοσολόγος με εξειδίκευση στις αναπνευστικές αλλεργίες, τροφικές αλλεργίες και ανοσοθεραπεία.',
    experience: 10, rating: 4.8, reviewCount: 224, consultationFee: 90, locationIdx: 5,
    languages: ['Ελληνικά', 'Αγγλικά'],
    services: ['Αλλεργιολογία', 'Δερματοτσιμπήματα', 'Αναπνευστικές αλλεργίες', 'Τροφικές αλλεργίες', 'Ανοσοθεραπεία', 'Σπιρομέτρηση'],
    insurance: ['ΕΟΠΥΥ', 'Generali', 'Groupama', 'Ιδιώτες'],
    education: [
      { degree: 'Ιατρική', institution: 'ΕΚΠΑ', year: 2008 },
      { degree: 'Ειδίκευση Αλλεργιολογίας', institution: 'ΝΙΜΤΣ', year: 2014 }
    ]
  },
  // General Medicine
  {
    firstName: 'Θεόδωρος', lastName: 'Αντωνίου', specialty: 'Γενική Ιατρική',
    bio: 'Γενικός Ιατρός με πολυετή εμπειρία σε πρωτοβάθμια φροντίδα υγείας, πρόληψη και διαχείριση χρόνιων νοσημάτων.',
    experience: 22, rating: 4.8, reviewCount: 634, consultationFee: 60, locationIdx: 6,
    languages: ['Ελληνικά', 'Αγγλικά'],
    services: ['Γενική εξέταση', 'Πρόληψη', 'Χρόνια νοσήματα', 'Εμβολιασμοί ενηλίκων', 'Έκδοση πιστοποιητικών', 'Τεστ Παπ'],
    insurance: ['ΕΟΠΥΥ', 'ΙΚΑ/ΕΦΚΑ', 'Allianz', 'Generali', 'Groupama', 'Ιδιώτες'],
    education: [
      { degree: 'Ιατρική', institution: 'Πανεπιστήμιο Ιωαννίνων', year: 1996 },
      { degree: 'Ειδίκευση Γενικής Ιατρικής', institution: 'Νοσοκομείο ΚΑΤ', year: 2002 }
    ]
  },
  // Rheumatology
  {
    firstName: 'Ολυμπία', lastName: 'Σεραφείμ', specialty: 'Ρευματολογία',
    bio: 'Ρευματολόγος με εξειδίκευση στη ρευματοειδή αρθρίτιδα, τον λύκο και τις μυοσκελετικές παθήσεις.',
    experience: 13, rating: 4.7, reviewCount: 176, consultationFee: 100, locationIdx: 0,
    languages: ['Ελληνικά', 'Αγγλικά'],
    services: ['Ρευματολογία', 'Ρευματοειδής αρθρίτιδα', 'Λύκος', 'Ουρική αρθρίτιδα', 'Οστεοπόρωση', 'Ινομυαλγία'],
    insurance: ['ΕΟΠΥΥ', 'ΙΚΑ/ΕΦΚΑ', 'AXA', 'Ιδιώτες'],
    education: [
      { degree: 'Ιατρική', institution: 'ΕΚΠΑ', year: 2005 },
      { degree: 'Ειδίκευση Ρευματολογίας', institution: 'Νοσοκομείο Λαϊκό', year: 2011 }
    ]
  },
  // Nephrology
  {
    firstName: 'Ευάγγελος', lastName: 'Χατζηγεωργίου', specialty: 'Νεφρολογία',
    bio: 'Νεφρολόγος με εμπειρία στη χρόνια νεφρική νόσο, τα νεφρολιθιαστικά και τη νεφρολογική υπέρταση.',
    experience: 16, rating: 4.7, reviewCount: 143, consultationFee: 100, locationIdx: 3,
    languages: ['Ελληνικά', 'Αγγλικά'],
    services: ['Νεφρολογία', 'Χρόνια νεφρική νόσος', 'Αρτηριακή υπέρταση', 'Νεφρολιθίαση', 'Αιμοκάθαρση'],
    insurance: ['ΕΟΠΥΥ', 'ΙΚΑ/ΕΦΚΑ', 'Interamerican', 'Ιδιώτες'],
    education: [
      { degree: 'Ιατρική', institution: 'ΑΠΘ', year: 2002 },
      { degree: 'Ειδίκευση Νεφρολογίας', institution: 'Νοσοκομείο Αιγινήτειο', year: 2008 }
    ]
  },
  // Second Cardiology Thessaloniki
  {
    firstName: 'Στέφανος', lastName: 'Παπαστεφάνου', specialty: 'Καρδιολογία',
    bio: 'Καρδιολόγος με εξειδίκευση στην επεμβατική καρδιολογία, αγγειοπλαστική στεφανιαίων και εμφυτεύσεις βηματοδοτών.',
    experience: 23, rating: 4.9, reviewCount: 567, consultationFee: 130, locationIdx: 3,
    languages: ['Ελληνικά', 'Αγγλικά', 'Γερμανικά'],
    services: ['Επεμβατική Καρδιολογία', 'Αγγειοπλαστική', 'Βηματοδότης', 'Στεφανιογραφία', 'Υπέρηχος καρδιάς'],
    insurance: ['ΕΟΠΥΥ', 'ΙΚΑ/ΕΦΚΑ', 'Generali', 'Allianz', 'AXA', 'Ιδιώτες'],
    education: [
      { degree: 'Ιατρική', institution: 'ΑΠΘ', year: 1995 },
      { degree: 'Ειδίκευση Καρδιολογίας', institution: 'ΑΧΕΠΑ', year: 2001 },
      { degree: 'Fellowship Επεμβατικής Καρδιολογίας', institution: 'Universität Hamburg', year: 2003 }
    ]
  },
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // Remove existing seeded doctors
  await Doctor.deleteMany({ 'profile.isSeed': true });
  console.log('Cleared old seed doctors');

  const hash = await bcrypt.hash('Doctor123!', 10);
  let created = 0;

  for (const def of doctorDefs) {
    const loc = locations[def.locationIdx];
    const doc = await Doctor.create({
      email: `${def.firstName.toLowerCase()}.${def.lastName.toLowerCase()}@medplatform.gr`,
      passwordHash: hash,
      role: 'doctor',
      profile: {
        firstName: def.firstName,
        lastName: def.lastName,
        title: 'Dr.',
        bio: def.bio,
        avatar: `https://api.dicebear.com/8.x/personas/svg?seed=${def.firstName}${def.lastName}`,
        phone: `210${Math.floor(1000000 + Math.random() * 9000000)}`,
        languages: def.languages,
        isSeed: true,
      },
      specialties: def.services,
      education: def.education,
      locations: [{
        name: loc.name,
        address: loc.address,
        city: loc.city,
        coords: loc.coords,
        phone: `210${Math.floor(1000000 + Math.random() * 9000000)}`,
        workingHours: [
          { day: 'monday', from: '09:00', to: '17:00' },
          { day: 'tuesday', from: '09:00', to: '17:00' },
          { day: 'wednesday', from: '09:00', to: '13:00' },
          { day: 'thursday', from: '09:00', to: '17:00' },
          { day: 'friday', from: '09:00', to: '15:00' },
        ]
      }],
      stats: {
        rating: def.rating,
        reviewCount: def.reviewCount,
        totalAppointments: def.reviewCount + Math.floor(Math.random() * 100),
      },
      pricing: {
        consultationFee: def.consultationFee,
        currency: 'EUR',
      },
      insurance: def.insurance,
      isVerified: true,
      isActive: true,
    });

    console.log(`✓ Created Dr. ${def.firstName} ${def.lastName} (${def.specialty})`);
    created++;
  }

  console.log(`\n✅ Seeded ${created} doctors successfully`);
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
