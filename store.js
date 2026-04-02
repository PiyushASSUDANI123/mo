import bcrypt from 'bcryptjs';

const testHash = bcrypt.hashSync('testpassword', 10);

export const users = [
  {
    id: 'usr_test_123',
    email: 'vendor@test.com',
    password: testHash,
    kycStep: 4,
    kycStatus: 'submitted',
    isApproved: true,
    createdAt: new Date().toISOString()
  }
];

export const kycStore = {
  'usr_test_123': {
    legalBusinessName: 'Mock Vendor Pvt Ltd',
    storeName: 'The Mock Store',
    supportEmail: 'vendor@test.com',
    phone: '9876543210',
    gstin: '22AAAAA0000A1Z5',
    pan: 'ABCDE1234F',
    agreedToTerms: true,
    submittedAt: new Date().toISOString()
  }
};
