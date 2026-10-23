/** Namespace `moyensAttestation` — moyens de preuve de présence des enseignants. */
export default {
  title: 'Proof means',
  subtitle:
    'Enrolled control devices and the proof means of teachers: personal code and fingerprint.',
  devices: {
    title: 'Control devices',
    subtitle: 'An enrolled device signs fingerprint readings. Revoke the one you lost.',
    emptyState: 'No enrolled device.',
    active: 'Active',
    revoked: 'Revoked',
    columns: {
      device: 'Device',
      lastUsed: 'Last used',
      status: 'Status',
    },
  },
  teacher: {
    title: "A teacher's proof means",
    subtitle: 'The personal code and the fingerprint are set by the institution, never by the teacher.',
    teacher: 'Teacher',
    codePin: 'Personal code',
    codePinSet: 'Set',
    codePinUnset: 'Not set: the teacher will not be able to attest with a code.',
    empreinte: 'Fingerprint',
    empreinteSet: 'Fingerprint enrolled',
    empreinteUnset: 'No fingerprint enrolled.',
  },
  actions: {
    revoke: 'Revoke this device',
    defineCode: 'Set the code',
    resetCode: 'Reset the code',
    removeCode: 'Remove the code',
    removeEmpreinte: 'Remove the fingerprint',
  },
  codeDialog: {
    title: 'Set the personal code',
    subtitle: 'Only the teacher knows the code. It is used to attest their presence at roll call.',
    code: 'Code (4 to 6 digits)',
    hint: 'To be given to the teacher through a secure channel.',
    invalid: 'The code must have 4 to 6 digits.',
    generatedTitle: 'New personal code',
    generatedSubtitle: 'This code is shown only once: give it to the teacher.',
  },
  revokeDialog: {
    title: 'Revoke this device?',
    message:
      'Fingerprint readings produced by “{device}” will no longer be accepted. The other devices keep working.',
  },
  resetDialog: {
    title: 'Reset the code?',
    message: 'The current code is replaced. The new code will be shown only once.',
  },
  removeCodeDialog: {
    title: 'Remove the personal code?',
    message:
      'The teacher will no longer be able to attest their presence with a code. They can still do so by signature or fingerprint.',
  },
  removeEmpreinteDialog: {
    title: 'Remove the fingerprint?',
    message:
      'The enrolled fingerprint is erased. The teacher will no longer be able to attest their presence by biometrics.',
  },
  messages: {
    deviceRevoked: 'Device revoked',
    codeSaved: 'Personal code saved',
    codeRemoved: 'Personal code removed',
    empreinteRemoved: 'Fingerprint removed',
  },
};
