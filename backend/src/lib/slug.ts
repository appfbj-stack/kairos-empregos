/**
 * Gera slug a partir de um título.
 * - lowercase, sem acento
 * - só letras, números e hífen
 * - colapsa hífens duplicados
 */
export function slugify(input: string): string {
  return input
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Sufixo numérico se já existir vaga com mesmo slug na agency.
 * Ex: auxiliar-de-producao-sorocaba -> auxiliar-de-producao-sorocaba-2
 */
export function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  return (async () => {
    const root = slugify(base) || 'vaga';
    let candidate = root;
    let n = 2;
    while (await exists(candidate)) {
      candidate = `${root}-${n}`;
      n += 1;
      if (n > 99) throw new Error('Não foi possível gerar slug único');
    }
    return candidate;
  })();
}