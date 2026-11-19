// Form schema and starting data for the resume.
// Deliberately excludes age, birthdate, sex, religion, civil status and nationality.
import { checkEmail, checkMeasurable, checkPhone, checkSummary, checkUrl, checkVerbs, checkZip } from './coach.js';

export const EXPERIENCE_TYPES = ['Work Experience', 'OJT / Internship', 'Apprenticeship', 'School Project', 'Other'];

/** The label shown on the resume for an experience type (blank for plain work experience). */
export const experienceLabel = (e) =>
  e.type === 'Other' ? String(e.typeOther || '').trim() : e.type === 'Work Experience' ? '' : e.type;

/** One optional professional link in the header; the type picks the icon. */
export const LINK_TYPES = ['LinkedIn', 'Facebook', 'GitHub', 'Portfolio', 'Website', 'Other'];

export const SECTIONS = [
  {
    id: 'personal',
    title: 'Header',
    desc: 'Photo, name, address with ZIP code, contact number, email and one link.',
    kind: 'object',
    photo: true,
    fields: [
      { key: 'firstName', label: 'First name', placeholder: 'John Rex', ac: 'given-name' },
      { key: 'middleName', label: 'Middle name', placeholder: 'T. (optional)', ac: 'additional-name' },
      { key: 'lastName', label: 'Last name', placeholder: 'Partoza', ac: 'family-name' },
      { key: 'suffix', label: 'Suffix', placeholder: 'Jr., III (optional)', ac: 'honorific-suffix' },
      { key: 'title', label: 'Desired position', placeholder: 'e.g. Junior Web Developer (optional)', full: true },
      { key: 'address', label: 'Address', placeholder: 'Street, Barangay, City/Municipality, Province', full: true, ac: 'street-address' },
      { key: 'zip', label: 'ZIP code', placeholder: '1100', ac: 'postal-code', inputMode: 'numeric', check: checkZip },
      { key: 'phone', label: 'Contact number', type: 'tel', placeholder: '0917 123 4567', ac: 'tel', check: checkPhone },
      { key: 'email', label: 'Email address', type: 'email', placeholder: 'johnrex.partoza@email.com', ac: 'email', full: true, check: checkEmail },
      { key: 'linkType', label: 'Link type', type: 'select', options: LINK_TYPES },
      {
        key: 'link', label: 'Profile link (optional)', type: 'url', placeholder: 'linkedin.com/in/johnrexpartoza', ac: 'url', check: checkUrl,
        hint: 'LinkedIn, portfolio, GitHub, Facebook or website — clickable in the PDF.',
      },
    ],
  },
  {
    id: 'summary',
    title: 'Summary Statement',
    desc: 'Your 2–3 sentence pitch: what can you do for the employer?',
    kind: 'object',
    fields: [
      {
        key: 'text', label: 'Summary', type: 'textarea', full: true, check: checkSummary,
        hint: '2–3 sentences. Say what value you bring, back it with a skill or result, and show your work ethic.',
        placeholder:
          'Customer-focused BS Business Administration graduate who can resolve client concerns quickly and accurately. Brings hands-on experience handling 50+ inquiries a day during OJT. Known for being punctual, coachable and calm under pressure.',
      },
    ],
  },
  {
    id: 'skills',
    title: 'Skills',
    desc: 'Relevant hard and soft skills — separate each skill with a comma.',
    kind: 'object',
    fields: [
      {
        key: 'hard', label: 'Hard / technical skills', type: 'textarea', full: true, split: 'skills',
        instruction: { text: 'Separate each skill with a comma', mark: ',' },
        hint: 'Mirror the exact keywords from the job posting — ATS software matches on them.',
        placeholder: 'MS Excel (Pivot Tables, VLOOKUP), Data Entry (60 WPM), Bookkeeping, CRM Software',
      },
      {
        key: 'soft', label: 'Soft skills', type: 'textarea', full: true, split: 'skills',
        instruction: { text: 'Separate each skill with a comma', mark: ',' },
        placeholder: 'Clear Communication, Teamwork, Time Management, Attention to Detail',
      },
    ],
  },
  {
    id: 'experience',
    title: 'Experience',
    desc: 'Work, OJT, apprenticeship or major school projects — most recent first.',
    kind: 'list',
    addLabel: 'Add experience',
    blank: () => ({ type: 'Work Experience', typeOther: '', role: '', organization: '', location: '', website: '', start: '', end: '', current: false, responsibilities: '', accomplishments: '' }),
    itemTitle: (it) => [it.role || 'Untitled role', it.organization || experienceLabel(it) || it.type],
    fields: [
      { key: 'type', label: 'Type', type: 'select', options: EXPERIENCE_TYPES },
      {
        key: 'typeOther', label: 'Specify type', placeholder: 'e.g. Volunteer Work, Part-time, Freelance',
        showWhen: (it) => it.type === 'Other',
      },
      { key: 'role', label: 'Role / Project title', placeholder: 'Customer Service Intern' },
      { key: 'organization', label: 'Organization / School', placeholder: 'ABC Corporation' },
      { key: 'location', label: 'Location', placeholder: 'Davao City' },
      { key: 'website', label: 'Company website (optional)', type: 'url', placeholder: 'abccorp.com.ph', full: true, check: checkUrl },
      { key: 'start', label: 'Start date', placeholder: 'Jun 2023' },
      { key: 'end', label: 'End date', placeholder: 'Dec 2023', disabledWhen: 'current' },
      { key: 'current', label: 'I’m currently in this role', type: 'checkbox', full: true },
      {
        key: 'responsibilities', label: 'Job responsibilities', type: 'textarea', full: true, check: checkVerbs,
        split: 'items',
        instruction: { text: 'End each item with a period or start a new line — each becomes its own bullet', mark: '.' },
        hint: 'Start each with an action verb: Managed, Prepared, Resolved, Built, Coordinated…',
        placeholder: 'Resolved billing and account concerns via phone and email. Prepared daily call reports for the team leader.',
      },
      {
        key: 'accomplishments', label: 'Accomplishments', type: 'textarea', full: true, check: checkMeasurable,
        split: 'items',
        instruction: { text: 'End each item with a period or start a new line — each becomes its own bullet', mark: '.' },
        hint: 'Use numbers: %, ₱, time saved, volume handled, ranking.',
        placeholder: 'Maintained a 96% customer satisfaction score across 3 months. Cut report preparation time by 30% with an Excel template.',
      },
    ],
  },
  {
    id: 'education',
    title: 'Education',
    desc: 'Degree, institution and graduation date.',
    kind: 'list',
    addLabel: 'Add education',
    blank: () => ({ degree: '', institution: '', graduation: '', honors: '' }),
    itemTitle: (it) => [it.degree || 'Untitled degree', it.institution],
    fields: [
      { key: 'degree', label: 'Degree / Program', placeholder: 'Bachelor of Science in Information Technology', full: true },
      { key: 'institution', label: 'Institution', placeholder: 'University of Mindanao', full: true },
      { key: 'graduation', label: 'Graduation date', placeholder: 'June 2024 or Expected 2025' },
      { key: 'honors', label: 'Honors (optional)', placeholder: 'Cum Laude' },
    ],
  },
  {
    id: 'credentials',
    title: 'Certifications & Licenses',
    desc: 'PRC, Civil Service, TESDA NC, online certificates relevant to the job.',
    kind: 'list',
    addLabel: 'Add certification',
    blank: () => ({ name: '', issuer: '', date: '', number: '' }),
    itemTitle: (it) => [it.name || 'Untitled certification', it.issuer],
    fields: [
      { key: 'name', label: 'Certification / License', placeholder: 'Computer Systems Servicing NC II', full: true },
      { key: 'issuer', label: 'Issuing body', placeholder: 'TESDA' },
      { key: 'date', label: 'Date earned', placeholder: 'March 2024' },
      { key: 'number', label: 'License / Certificate no. (optional)', placeholder: '', full: true },
    ],
  },
  {
    id: 'trainings',
    title: 'Seminars & Trainings',
    desc: 'Seminars, workshops and trainings you attended — most recent first.',
    kind: 'list',
    addLabel: 'Add seminar or training',
    blank: () => ({ name: '', organizer: '', location: '', date: '' }),
    itemTitle: (it) => [it.name || 'Untitled seminar / training', it.organizer],
    fields: [
      { key: 'name', label: 'Seminar / Training title', placeholder: 'Cybersecurity Awareness Seminar', full: true },
      { key: 'organizer', label: 'Organizer / Conducted by', placeholder: 'DICT Region XI' },
      { key: 'location', label: 'Venue / Location (optional)', placeholder: 'Davao City or Online' },
      { key: 'date', label: 'Date attended', placeholder: 'March 2024' },
    ],
  },
  {
    id: 'references',
    title: 'References',
    desc: 'People who can vouch for your work or character — shown at the end of the resume.',
    kind: 'list',
    addLabel: 'Add reference',
    blank: () => ({ name: '', position: '', organization: '', contact: '' }),
    itemTitle: (it) => [it.name || 'Untitled reference', it.organization],
    fields: [
      { key: 'name', label: 'Full name', placeholder: 'Ms. Maria Reyes', full: true },
      { key: 'position', label: 'Position', placeholder: 'Team Leader' },
      { key: 'organization', label: 'Company / Organization', placeholder: 'ABC Corporation' },
      { key: 'contact', label: 'Contact number or email', placeholder: '0918 765 4321 or email', full: true },
    ],
  },
];

export const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

export function blankState() {
  return {
    personal: { firstName: '', middleName: '', lastName: '', suffix: '', title: '', address: '', zip: '', phone: '', email: '', linkType: 'LinkedIn', link: '', photo: '' },
    summary: { text: '' },
    skills: { hard: '', soft: '' },
    experience: [SECTION_BY_ID.experience.blank()],
    trainings: [],
    education: [SECTION_BY_ID.education.blank()],
    credentials: [],
    references: [],
  };
}

export function sampleState() {
  return {
    personal: {
      firstName: 'Andrea', middleName: 'Reyes', lastName: 'Villanueva', suffix: '',
      title: 'Junior Web Developer', photo: '',
      address: '123 Mabini St., Brgy. San Isidro, Quezon City, Metro Manila', zip: '1100',
      phone: '0917 123 4567', email: 'andrea.villanueva@email.com',
      linkType: 'LinkedIn', link: 'linkedin.com/in/andreavillanueva',
    },
    summary: {
      text:
        'Front-end developer who builds fast, responsive web pages that turn designs into working features with minimal rework. Brings 5 months of agency OJT shipping production code in HTML, CSS, JavaScript and React. Dependable and detail-oriented, with a habit of documenting fixes so the whole team moves faster.',
    },
    skills: {
      hard: 'HTML5 & CSS3, JavaScript (ES6+), React, Git & GitHub, Responsive Web Design, REST APIs, MySQL, Figma',
      soft: 'Clear Communication, Teamwork, Problem Solving, Time Management, Attention to Detail, Adaptability',
    },
    experience: [
      {
        type: 'OJT / Internship', role: 'Web Developer Intern', organization: 'Bright Pixel Digital Solutions', location: 'Pasig City',
        website: 'brightpixel.ph',
        start: 'Jan 2024', end: 'May 2024', current: false,
        responsibilities:
          'Built responsive landing pages in HTML, CSS and JavaScript from Figma designs\nDeveloped reusable React components for two client dashboards\nCollaborated with QA in weekly sprints using Git and GitHub pull requests',
        accomplishments:
          'Resolved 40+ UI bugs across 3 client projects before launch\nReduced landing page load time by 35% by optimizing images and scripts',
      },
      {
        type: 'School Project', role: 'Lead Developer, Barangay Clearance Request System (Capstone)', organization: 'Polytechnic University of the Philippines', location: 'Manila',
        website: '',
        start: 'Aug 2023', end: 'Apr 2024', current: false,
        responsibilities:
          'Led a 4-member team in planning, building and testing a web-based request system\nDesigned the MySQL database and REST API used by the front end',
        accomplishments:
          'Cut average clearance processing time from 2 days to 3 hours in a pilot with 1 barangay\nEarned a 1.25 grade and Best Capstone Project among 18 teams',
      },
    ],
    trainings: [
      { name: 'Web Accessibility and Inclusive Design Workshop', organizer: 'DICT Region XI', location: 'Davao City', date: 'February 2024' },
      { name: 'Introduction to Cloud Computing Seminar', organizer: 'AWS Educate', location: 'Online', date: 'October 2023' },
    ],
    education: [
      { degree: 'Bachelor of Science in Information Technology', institution: 'Polytechnic University of the Philippines', graduation: 'July 2024', honors: 'Cum Laude' },
    ],
    credentials: [
      { name: 'Career Service Professional Eligibility', issuer: 'Civil Service Commission', date: 'August 2024', number: '' },
      { name: 'Computer Systems Servicing NC II', issuer: 'TESDA', date: 'March 2023', number: '' },
      { name: 'Responsive Web Design Certification', issuer: 'freeCodeCamp', date: 'October 2023', number: '' },
    ],
    references: [
      { name: 'Engr. Ramon P. Cruz', position: 'Senior Software Engineer', organization: 'Bright Pixel Digital Solutions', contact: '0918 765 4321' },
      { name: 'Prof. Liza M. Santos', position: 'Capstone Adviser', organization: 'Polytechnic University of the Philippines', contact: 'lsantos@pup.edu.ph' },
    ],
  };
}
