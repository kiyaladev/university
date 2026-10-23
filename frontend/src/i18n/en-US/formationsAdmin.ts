/** Namespace `formationsAdmin` — Continuing education page (admin). */
export default {
  title: 'Continuing education',
  subtitle:
    "Hub management: courses are published to the showcase, filled and confirmed at the desk (pilot mode). The registrar then hands out the training certificate. You are viewing the full catalog here, drafts included.",
  actions: {
    seeShowcase: 'View public showcase',
    seeShowcaseTooltip: 'Page seen by candidates — published courses only',
    newFormation: 'New course',
    registrations: 'Registrations',
  },
  dialog: {
    title: {
      edit: 'Edit course',
      create: 'New course',
    },
    subtitle: 'Every course starts as a draft and is not available for sale until published. After the first confirmed registration, its title and price are locked.',
    sections: {
      presentation: 'Overview',
      price: 'Price',
      schedule: 'Schedule',
    },
    fields: {
      title: 'Course title *',
      titleHint: 'E.g. Professional accounting certification',
      categoryHint: 'E.g. Computing, Management, Health…',
      location: 'Location / district',
      locationHint: 'Campus, room, faculty…',
      price: 'Price (GNF) *',
      duration: 'Duration (hours)',
      capacity: 'Capacity (seats)',
      capacityHint: 'Leave blank for open access',
    },
    messages: {
      updated: 'Course updated',
      created: 'Course saved — remember to publish it',
    },
  },
  filters: {
    searchPlaceholder: 'Search (title, category, location…)',
    searchChip: '"{query}"',
  },
  stats: {
    trained: 'Trained (confirmed registrations)',
    revenue: 'Revenue collected',
    fillRate: 'Fill rate',
    total: 'Courses',
  },
  table: {
    columns: {
      formation: 'Course',
      price: 'Price',
      capacity: 'Seats',
      registered: 'Registered',
      revenue: 'Revenue',
    },
    free: 'Free',
    unlimited: 'Open',
    requestsCount: '{count} requests',
    paidCount: '{count} paid',
    tooltips: {
      publish: 'Publish the course',
      registrations: 'Registrations',
      delete: 'Delete draft',
    },
    aria: {
      publish: 'Publish the course',
      close: 'Close the course',
      edit: 'Edit the course',
      registrations: 'View the registration list',
      delete: 'Delete the draft',
    },
  },
  registry: {
    title: 'Registry — {title}',
    columns: {
      fileNumber: 'File no.',
      registrant: 'Registrant',
      request: 'Request',
    },
    tooltips: {
      confirmPayment: 'Confirm the payment',
      cancelRequest: 'Cancel the request',
      printCertificate: 'Enrollment confirmation',
    },
    aria: {
      confirmPayment: 'Confirm the payment',
      cancelRequest: 'Cancel the request',
      printCertificate: 'Print the enrollment confirmation',
    },
  },
  card: {
    remainingSeats: '{count} / {capacity} seats',
    unlimitedSeats: 'Unlimited seats',
  },
  emptyState: {
    title: 'No course matches these criteria.',
    description:
      'A course starts as a draft, then is published to appear on the public showcase.',
  },
  dialogs: {
    publish: {
      title: 'Publish this course?',
      message:
        '"{title}" goes live on the public showcase: requests and Mobile Money payments will become possible.',
    },
    close: {
      title: 'Close this course?',
      message:
        'The showcase will stop offering "{title}"; pending requests can no longer be confirmed. The class roster becomes official.',
    },
    delete: {
      title: 'Delete this draft?',
      message: '"{title}" was never sold: deleting it leaves no customer trace.',
    },
    confirmPayment: {
      title: 'Confirm the payment?',
      message:
        'Pilot confirmation: the Mobile Money operator has collected — {reference} moves to REUSSI and request {numero} moves to CONFIRMEE.',
      paymentFallback: 'the payment',
    },
    cancelRequest: {
      title: 'Cancel this request?',
      message: 'Request {numero} will be cancelled; its seat is released back to the showcase.',
      confirm: 'Cancel the request',
    },
  },
  messages: {
    published: 'Course published — now on sale in the showcase',
    closed: 'Course closed — no new requests possible',
    draftDeleted: 'Draft deleted',
    registrationConfirmed: '{numero} confirmed — seat reserved',
    registrationCancelled: '{numero} cancelled',
  },
};
