/**
 * Helper: gera 3 PDFs de curriculos ficticios para anexar na seed.
 */
import PDFDocument from 'pdfkit';
import { randomUUID } from 'node:crypto';

interface SampleCandidate {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  experience: string;
  education: string;
  skills: string[];
}

const samples: SampleCandidate[] = [
  {
    fullName: 'Patricia Souza Industrial',
    email: 'patricia.industrial@example.com',
    phone: '(15) 99999-1234',
    city: 'Sorocaba',
    state: 'SP',
    experience: '5 anos de experiencia como auxiliar de producao na industria ABC. Atuacao com montagem de pecas, controle de qualidade e operacao de maquinas industriais. Turno integral disponivel.',
    education: 'Ensino medio completo. Curso tecnico em eletrotecnica pelo SENAI Sorocaba (2019).',
    skills: ['Pacote Office', 'Leitura de plantas', 'Trabalho em equipe', 'CNH B'],
  },
  {
    fullName: 'Roberto Mendes Designer',
    email: 'roberto.designer@example.com',
    phone: '(15) 99999-5678',
    city: 'Votorantim',
    state: 'SP',
    experience: '3 anos como designer grafico freelancer. Especialidade em identidade visual, social media e UI basico. Portfolio com projetos para pequenas empresas de Sorocaba.',
    education: 'Superior em Design Grafico - UNISO (cursando 7o periodo).',
    skills: ['Figma', 'Adobe Photoshop', 'Illustrator', 'Ingles intermediario'],
  },
  {
    fullName: 'Mariana Costa Atendente',
    email: 'mariana.atendente@example.com',
    phone: '(15) 99999-9012',
    city: 'Itu',
    state: 'SP',
    experience: '2 anos como atendente em loja de calcados. Caixa, reposicao, atendimento ao cliente, controle de estoque. Disponibilidade para turnos.',
    education: 'Ensino medio completo. Curso tecnico em Administracao.',
    skills: ['Atendimento ao cliente', 'Caixa', 'CNH A', 'Trabalho em equipe'],
  },
];

export async function generateSampleResume(c: SampleCandidate): Promise<{ buffer: Buffer; candidate: SampleCandidate }> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), candidate: c }));
    doc.on('error', reject);

    doc.fontSize(20).text(c.fullName, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('gray').text(`${c.city}, ${c.state} - ${c.phone} - ${c.email}`);
    doc.moveDown(1.5);
    doc.fillColor('black').fontSize(14).text('RESUMO');
    doc.fontSize(11).text(c.experience, { align: 'justify' });
    doc.moveDown(1);
    doc.fontSize(14).text('FORMACAO');
    doc.fontSize(11).text(c.education);
    doc.moveDown(1);
    doc.fontSize(14).text('HABILIDADES');
    doc.fontSize(11).text(c.skills.join(', '));

    doc.end();
  });
}

export const sampleCandidates = samples;