export function contextoDoLead(lead) {
  const campos = [
    lead.nome && `Nome: ${lead.nome}`,
    lead.empresa && `Empresa: ${lead.empresa}`,
    lead.cidade && `Cidade: ${lead.cidade}`,
    lead.segmento && `Segmento: ${lead.segmento}`,
    lead.solucao_interesse && `Solução de interesse: ${lead.solucao_interesse}`,
    lead.valor_estimado && `Valor estimado discutido: ${lead.valor_estimado}`
  ].filter(Boolean)

  if (campos.length === 0) return 'Contexto do lead: ainda não coletado.'
  return `Contexto do lead:\n${campos.join('\n')}`
}
