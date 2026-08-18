import 'dotenv/config'; require('dotenv').config({ path: '.env.local' }); import { prisma } from './lib/db/client'; prisma.staffUser.findMany().then(console.log);
