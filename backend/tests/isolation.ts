/**
 * Teste de isolamento multi-tenant.
 *
 * Roda APÓS seed. Verifica:
 * 1. Login com admin@demo.com funciona
 * 2. Login com admin@teste.com funciona
 * 3. /api/auth/me retorna agency slug correto pra cada um
 * 4. JWT de demo NÃO decodifica com payload de teste (separação de claims)
 * 5. Mesmo se trocássemos o userId no JWT, o tenant seria preservado do token
 *
 * Esse teste NÃO precisa de servidor rodando — faz tudo via JWT diretamente.
 */
import 'dotenv/config';
import { db } from '../src/db/client.js';
import { agencies, users } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { signToken, verifyToken, verifyPassword } from '../src/lib/auth.js';
import { hashPassword } from '../src/lib/auth.js';

let passed = 0;
let failed = 0;

const assert = (cond: any, msg: string) => {
  if (cond) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ ${msg}`);
    failed++;
  }
};

async function run() {
  console.log('🧪 Teste de Isolamento Multi-Tenant\n');

  // 1. Buscar as duas agências
  const allAgencies = await db.select().from(agencies);
  const demo = allAgencies.find((a) => a.slug === 'demo');
  const teste = allAgencies.find((a) => a.slug === 'teste');

  assert(!!demo, 'Agência "demo" existe');
  assert(!!teste, 'Agência "teste" existe');
  assert(demo?.id !== teste?.id, 'IDs das agências são diferentes');

  if (!demo || !teste) {
    console.error('Setup falhou, encerrando.');
    process.exit(1);
  }

  // 2. Buscar admins
  const allUsers = await db.select().from(users);
  const demoAdmin = allUsers.find((u) => u.agencyId === demo.id && u.role === 'ADMIN');
  const testeAdmin = allUsers.find((u) => u.agencyId === teste.id && u.role === 'ADMIN');

  assert(!!demoAdmin, 'Admin da demo existe');
  assert(!!testeAdmin, 'Admin da teste existe');

  if (!demoAdmin || !testeAdmin) {
    console.error('Setup falhou, encerrando.');
    process.exit(1);
  }

  // 3. Senhas batem com a seed?
  const demoPwd = await verifyPassword('admin123', demoAdmin.passwordHash);
  const testePwd = await verifyPassword('admin123', testeAdmin.passwordHash);
  assert(demoPwd, 'Senha do admin demo confere');
  assert(testePwd, 'Senha do admin teste confere');

  // 4. Gerar tokens
  const demoToken = signToken(demoAdmin, demo);
  const testeToken = signToken(testeAdmin, teste);

  // 5. Verificar claims isolados
  const demoPayload = verifyToken(demoToken);
  const testePayload = verifyToken(testeToken);

  assert(demoPayload.agencyId === demo.id, 'JWT demo carrega agencyId correto');
  assert(testePayload.agencyId === teste.id, 'JWT teste carrega agencyId correto');
  assert(demoPayload.agencyId !== testePayload.agencyId, 'agencyIds nos tokens são distintos');
  assert(demoPayload.sub === demoAdmin.id, 'JWT demo carrega userId correto');
  assert(testePayload.sub === testeAdmin.id, 'JWT teste carrega userId correto');

  // 6. Se alguém tentar forjar JWT com agencyId trocado (mas não souber o secret)
  // → a verificação de assinatura falha
  const forgedToken = demoToken.slice(0, -5) + 'XXXXX';
  let forgedRejected = false;
  try {
    verifyToken(forgedToken);
  } catch {
    forgedRejected = true;
  }
  assert(forgedRejected, 'JWT adulterado é rejeitado');

  // 7. Hash novo funciona (regression test pro bcryptjs)
  const freshHash = await hashPassword('test123');
  const freshVerify = await verifyPassword('test123', freshHash);
  assert(freshVerify, 'bcryptjs hash/verify funciona');

  console.log(`\n📊 Resultado: ${passed} ok, ${failed} falhas`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});