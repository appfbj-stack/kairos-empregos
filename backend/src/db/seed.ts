import 'dotenv/config';
import { pool, db } from './client.js';
import { agencies, users, companies, jobs, candidates, applications, superAdmins } from './schema.js';
import bcrypt from 'bcryptjs';
import { sql, eq } from 'drizzle-orm';
import { slugify } from '../lib/slug.js';

async function seed() {
  console.log('🌱 Seed KAIROS RH...');

  // Limpa apenas em dev
  if (process.env.NODE_ENV !== 'production') {
    console.log('   🧹 Limpando tabelas...');
    await db.execute(sql`TRUNCATE TABLE audit_logs, users, agencies RESTART IDENTITY CASCADE`);
  }

  // ====== AGENCY DEMO ======
  const demoSlug = 'demo';
  const [demoAgency] = await db
    .insert(agencies)
    .values({
      name: 'Agência Demo',
      slug: demoSlug,
      plan: 'PROFISSIONAL',
      status: 'ATIVA',
      licenseStart: new Date(),
      licenseEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 ano
      primaryColor: '#0F172A',
      phone: '(15) 3333-0000',
      whatsapp: '(15) 99999-0000',
      email: 'contato@agenciademo.com.br',
      city: 'Sorocaba',
      state: 'SP',
      description: 'Agência de demonstração do KAIROS RH.',
      confirmationMessage: 'Recebemos sua candidatura! Em breve entraremos em contato.',
      privacyPolicy: 'Seus dados são tratados conforme a LGPD.',
    })
    .returning();

  console.log(`   ✅ Agência "${demoAgency.name}" (slug: ${demoSlug})`);

  // ====== AGENCY TESTE (pra isolamento) ======
  const [testAgency] = await db
    .insert(agencies)
    .values({
      name: 'Agência Teste',
      slug: 'teste',
      plan: 'ESSENCIAL',
      status: 'TESTE',
      licenseStart: new Date(),
      licenseEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
      primaryColor: '#7C3AED',
      city: 'Itapetininga',
      state: 'SP',
    })
    .returning();

  console.log(`   ✅ Agência "${testAgency.name}" (slug: teste)`);

  // ====== USERS ======
  const adminHash = await bcrypt.hash('admin123', 10);
  const recruiterHash = await bcrypt.hash('recruiter123', 10);

  await db.insert(users).values([
    {
      agencyId: demoAgency.id,
      name: 'Admin Demo',
      email: 'admin@demo.com',
      passwordHash: adminHash,
      role: 'ADMIN',
    },
    {
      agencyId: demoAgency.id,
      name: 'Recrutadora Demo',
      email: 'recrutador@demo.com',
      passwordHash: recruiterHash,
      role: 'RECRUITER',
    },
    {
      agencyId: testAgency.id,
      name: 'Admin Teste',
      email: 'admin@teste.com',
      passwordHash: adminHash,
      role: 'ADMIN',
    },
  ]);

  console.log(`   ✅ 3 usuários criados (2 demo + 1 teste)`);

  // ====== EMPRESAS DEMO ======
  const demoCompanies = await db
    .insert(companies)
    .values([
      {
        agencyId: demoAgency.id,
        legalName: 'Indústria ABC Ltda',
        tradeName: 'ABC Industrial',
        cnpj: '12.345.678/0001-90',
        contactName: 'João Silva',
        phone: '(15) 3333-1000',
        whatsapp: '(15) 99999-1000',
        email: 'rh@abcindustrial.com.br',
        city: 'Sorocaba',
        state: 'SP',
      },
      {
        agencyId: demoAgency.id,
        legalName: 'Comércio XYZ S/A',
        tradeName: 'XYZ Atacado',
        cnpj: '23.456.789/0001-01',
        contactName: 'Maria Souza',
        phone: '(15) 3333-2000',
        whatsapp: '(15) 99999-2000',
        email: 'rh@xyzatacado.com.br',
        city: 'Sorocaba',
        state: 'SP',
      },
      {
        agencyId: demoAgency.id,
        legalName: 'Tech Brasil Soluções ME',
        tradeName: 'Tech Brasil',
        cnpj: '34.567.890/0001-12',
        contactName: 'Carlos Pereira',
        phone: '(15) 3333-3000',
        whatsapp: '(15) 99999-3000',
        email: 'contato@techbrasil.com.br',
        city: 'Votorantim',
        state: 'SP',
      },
    ])
    .returning();
  console.log(`   ✅ ${demoCompanies.length} empresas criadas (Agência Demo)`);

  // ====== VAGAS DEMO ======
  const jobSeeds = [
    { company: demoCompanies[0], title: 'Auxiliar de Produção', city: 'Sorocaba', contractType: 'CLT' as const, modality: 'PRESENCIAL' as const, salary: '2100.00', vacancies: 5, status: 'PUBLICADA' as const, requirements: 'Ensino médio completo. Experiência industrial desejável.', benefits: 'VT + VR + convênio médico.' },
    { company: demoCompanies[0], title: 'Operador de Máquinas', city: 'Sorocaba', contractType: 'CLT' as const, modality: 'PRESENCIAL' as const, salary: '2500.00', vacancies: 2, status: 'PUBLICADA' as const, requirements: 'Curso técnico em mecânica ou eletrotécnica.', benefits: 'VT + VR + convênio + PLR.' },
    { company: demoCompanies[1], title: 'Atendente de Loja', city: 'Sorocaba', contractType: 'CLT' as const, modality: 'PRESENCIAL' as const, salary: '1800.00', vacancies: 3, status: 'PUBLICADA' as const, requirements: 'Ensino médio completo. Boa comunicação.', benefits: 'VT + VR + comissão.' },
    { company: demoCompanies[1], title: 'Auxiliar Administrativo', city: 'Sorocaba', contractType: 'CLT' as const, modality: 'PRESENCIAL' as const, salary: '2000.00', vacancies: 1, status: 'PUBLICADA' as const, requirements: 'Ensino médio completo. Pacote Office.', benefits: 'VT + VR + convênio.' },
    { company: demoCompanies[1], title: 'Estoquista', city: 'Sorocaba', contractType: 'CLT' as const, modality: 'PRESENCIAL' as const, salary: '1900.00', vacancies: 2, status: 'PUBLICADA' as const, requirements: 'Ensino fundamental.', benefits: 'VT + VR.' },
    { company: demoCompanies[2], title: 'Desenvolvedor Junior', city: 'Votorantim', contractType: 'CLT' as const, modality: 'HIBRIDO' as const, salary: '3500.00', vacancies: 2, status: 'PUBLICADA' as const, requirements: 'Conhecimento em JavaScript ou Python.', benefits: 'VT + VR + plano de saúde + Gympass.' },
    { company: demoCompanies[2], title: 'Designer Gráfico', city: 'Votorantim', contractType: 'PJ' as const, modality: 'REMOTO' as const, salary: '4500.00', vacancies: 1, status: 'PUBLICADA' as const, requirements: 'Portfólio com pelo menos 3 projetos.', benefits: 'PJ com nota fiscal.' },
    { company: demoCompanies[0], title: 'Auxiliar de Limpeza', city: 'Sorocaba', contractType: 'CLT' as const, modality: 'PRESENCIAL' as const, salary: '1700.00', vacancies: 4, status: 'PUBLICADA' as const, requirements: 'Ensino fundamental.', benefits: 'VT + VR.' },
    { company: demoCompanies[1], title: 'Vendedor Externo', city: 'Sorocaba', contractType: 'CLT' as const, modality: 'PRESENCIAL' as const, salary: '2200.00', vacancies: 2, status: 'PUBLICADA' as const, requirements: 'CNH B. Experiência com vendas.', benefits: 'VT + VR + comissão + carro da empresa.' },
    { company: demoCompanies[2], title: 'Assistente de Marketing', city: 'Votorantim', contractType: 'ESTAGIO' as const, modality: 'HIBRIDO' as const, salary: '1500.00', vacancies: 1, status: 'PUBLICADA' as const, requirements: 'Cursando Marketing ou Publicidade.', benefits: 'VT + VR + bolsa-auxílio.' },
  ];

  for (const j of jobSeeds) {
    const slug = slugify(`${j.title} ${j.company.tradeName} ${j.city}`);
    await db.insert(jobs).values({
      agencyId: demoAgency.id,
      companyId: j.company.id,
      slug,
      title: j.title,
      city: j.city,
      state: 'SP',
      salary: j.salary,
      contractType: j.contractType,
      modality: j.modality,
      requirements: j.requirements,
      benefits: j.benefits,
      vacancies: j.vacancies,
      status: j.status,
      publishedAt: new Date(),
      description: `Vaga de ${j.title} para a empresa ${j.company.tradeName} em ${j.city}/SP.`,
    });
  }
  console.log(`   ✅ ${jobSeeds.length} vagas criadas (Agência Demo)`);

  // ====== 1 empresa + 2 vagas da TESTE (pra provar isolamento) ======
  const testCo = await db.insert(companies).values({
    agencyId: testAgency.id,
    legalName: 'Indústria Teste Ltda',
    tradeName: 'Teste Ind',
    city: 'Itapetininga',
    state: 'SP',
  }).returning();
  await db.insert(jobs).values([
    { agencyId: testAgency.id, companyId: testCo[0].id, slug: 'vaga-teste-itapetininga', title: 'Vaga Teste', city: 'Itapetininga', state: 'SP', status: 'PUBLICADA', publishedAt: new Date(), vacancies: 1 },
    { agencyId: testAgency.id, companyId: testCo[0].id, slug: 'outra-vaga-teste', title: 'Outra Vaga Teste', city: 'Itapetininga', state: 'SP', status: 'RASCUNHO', vacancies: 1 },
  ]);
  console.log(`   ✅ 1 empresa + 2 vagas criadas (Agência Teste — pra isolamento)`);

  // ====== CANDIDATOS DEMO (30 fictícios) ======
  const firstNames = ['Ana','Bruno','Carla','Diego','Elena','Felipe','Gabriela','Hugo','Isabela','João','Karen','Lucas','Mariana','Nicolas','Olivia','Paulo','Renata','Sergio','Tatiana','Vinicius','Yasmin','Zeca','Amanda','Bruno','Camila','Daniel','Eduarda','Felipe','Giovanna','Henrique'];
  const lastNames = ['Silva','Santos','Oliveira','Souza','Lima','Pereira','Ferreira','Almeida','Costa','Rodrigues','Martins','Carvalho','Ribeiro','Gomes','Martins','Sousa'];
  const roles = ['Auxiliar de Produção','Atendente','Operador','Vendedor','Desenvolvedor','Designer','Estoquista','Auxiliar Administrativo'];
  const cities = ['Sorocaba','Votorantim','Itu','Salto','Araçoiaba da Serra'];

  const demoJobsList = await db.select().from(jobs).where(eq(jobs.agencyId, demoAgency.id));
  const publishedDemoJobs = demoJobsList.filter((j) => j.status === 'PUBLICADA');

  const candidateInserts: any[] = [];
  for (let i = 0; i < 30; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[i % lastNames.length];
    const phone = `(15) 9${String(8000 + i).padStart(4, '0')}-${String(1000 + i * 13).padStart(4, '0')}`;
    candidateInserts.push({
      agencyId: demoAgency.id,
      fullName: `${fn} ${ln}`,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}.${i}@example.com`,
      phone: phone.replace(/\D/g, ''),
      cpf: String(10000000000 + i * 12345).slice(0, 11),
      city: cities[i % cities.length],
      state: 'SP',
      education: i % 3 === 0 ? 'Ensino Médio completo' : 'Ensino Superior em andamento',
      experience: `${1 + (i % 5)} anos de experiência na área.`,
      desiredRole: roles[i % roles.length],
      salaryExpectation: String(1800 + (i % 5) * 400),
      availability: i % 2 === 0 ? 'Imediata' : '15 dias',
      cnh: i % 4 === 0 ? 'B' : null,
    });
  }
  const insertedCands = await db.insert(candidates).values(candidateInserts).returning();
  console.log(`   ✅ ${insertedCands.length} candidatos criados (Agência Demo)`);

  // Algumas candidaturas: cada candidato para 1-2 vagas, com stages variados
  const stages = ['NOVO','NOVO','NOVO','EM_ANALISE','EM_ANALISE','PRE_SELECIONADO','ENTREVISTA','APROVADO'] as const;
  const appInserts: any[] = [];
  for (let i = 0; i < insertedCands.length; i++) {
    const c = insertedCands[i];
    const job = publishedDemoJobs[i % publishedDemoJobs.length];
    if (job && i % 3 !== 0) { // 2/3 candidatam
      appInserts.push({
        agencyId: demoAgency.id,
        candidateId: c.id,
        jobId: job.id,
        stage: stages[i % stages.length],
      });
    }
    // ~1/3 candidatam a uma segunda vaga também
    if (job && i % 7 === 0) {
      const other = publishedDemoJobs[(i + 3) % publishedDemoJobs.length];
      if (other && other.id !== job.id) {
        appInserts.push({
          agencyId: demoAgency.id,
          candidateId: c.id,
          jobId: other.id,
          stage: 'NOVO',
        });
      }
    }
  }
  if (appInserts.length) {
    await db.insert(applications).values(appInserts);
  }
  console.log(`   ✅ ${appInserts.length} candidaturas criadas (Agência Demo)`);

  console.log('\n📋 Credenciais:');
  console.log('   ADMIN Demo: admin@demo.com / admin123');
  console.log('   RECRUITER Demo: recrutador@demo.com / recruiter123');
  console.log('   ADMIN Teste: admin@teste.com / admin123 (para teste de isolamento)');
  console.log('   SUPER ADMIN: super@kairosrh.com / super123');

  // ====== SUPER ADMIN ======
  const superHash = await bcrypt.hash('super123', 10);
  await db.insert(superAdmins).values({
    name: 'Pastor Fernando',
    email: 'super@kairosrh.com',
    passwordHash: superHash,
    isActive: true,
  });
  console.log('   ✅ Super Admin criado');

  console.log('\n🔗 URLs públicas (Agência Demo):');
  console.log('   http://localhost:8031/api/public/agencies/demo/jobs');
  console.log('   http://localhost:8031/api/public/agencies/demo/jobs/auxiliar-de-producao-abc-industrial-sorocaba');

  await pool.end();
  console.log('\n🎉 Seed concluído.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});