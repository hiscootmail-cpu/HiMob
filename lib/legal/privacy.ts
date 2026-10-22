import type { LegalDocument } from "@/lib/legal/types";

/*
 * Política de Privacidade da Hi Scoot (LGPD, Lei nº 13.709/2018).
 * RASCUNHO escrito em 19/10/2026 com as regras já aprovadas da plataforma.
 * Precisa de revisão de um advogado antes do lançamento. Os campos entre
 * colchetes ainda precisam ser preenchidos.
 */

export const privacy: Record<"pt" | "en", LegalDocument> = {
  pt: {
    title: "Política de Privacidade",
    updated: "Rascunho de 19 de outubro de 2026",
    intro: [
      "Esta Política explica quais dados pessoais a Hi Scoot trata, para quê, com quem compartilha, por quanto tempo guarda e como você exerce seus direitos, de acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, \"LGPD\") e o Marco Civil da Internet (Lei nº 12.965/2014).",
    ],
    sections: [
      {
        title: "1. Quem cuida dos seus dados",
        paragraphs: [
          "Controladora: [razão social], CNPJ nº [número], com sede em [endereço].",
          "Encarregado pelo tratamento de dados (art. 41 da LGPD): [nome], pelo e-mail [e-mail do encarregado].",
        ],
      },
      {
        title: "2. Dados que tratamos",
        paragraphs: [
          "Cadastro: nome completo, e-mail, telefone, cidade e senha (guardada de forma cifrada pelo provedor de login).",
          "Verificação de identidade: fotos ou PDF da frente e do verso do documento oficial com foto, ou carta escrita à mão com nome social e CPF.",
          "Conta Mercado Pago: identificador da conta e as chaves de acesso que o Mercado Pago entrega quando você autoriza a Hi Scoot. Não recebemos nem guardamos números de cartão.",
          "Anúncios: fotos, descrição, preço, horários, endereço de retirada e localização do equipamento.",
          "Reservas e pagamentos: datas, valores, situação da reserva e do pagamento, códigos de PIX e devoluções.",
          "Retirada e devolução: fotos do equipamento e o código da etiqueta lido pelo Rider.",
          "Conversas, avaliações e avisos trocados na plataforma.",
          "Registros de acesso à aplicação (endereço IP, data e hora), conforme o art. 15 do Marco Civil da Internet.",
        ],
      },
      {
        title: "3. Por que tratamos e com qual base legal",
        paragraphs: [
          "Prestar o serviço (criar a conta, publicar anúncios, fazer reservas, pagamentos, retirada, devolução e avaliações): execução de contrato (art. 7º, V).",
          "Verificar a identidade e manter a segurança das pessoas: proteção da vida e da incolumidade física do titular ou de terceiros (art. 7º, VII), prevenção à fraude e legítimo interesse (art. 7º, IX).",
          "Guardar registros de acesso e atender obrigações legais e regulatórias: cumprimento de obrigação legal (art. 7º, II).",
          "Defender direitos em processos judiciais, administrativos ou arbitrais: exercício regular de direitos (art. 7º, VI).",
        ],
      },
      {
        title: "4. Segurança das pessoas e da sociedade",
        paragraphs: [
          "Para a segurança de quem usa a plataforma e da sociedade, é necessário fornecer os dados de identificação pedidos pela plataforma. A Hi Scoot faz a gestão da conexão entre Host e Rider e precisa saber quem está de cada lado de cada aluguel.",
          "Cada pessoa é responsável pelos próprios atos. Mesmo assim, acidentes podem acontecer, e a identificação imediata do usuário pode ser importante para o seu bem-estar: por exemplo, para avisar familiares ou ajudar no atendimento de emergência.",
          "Por isso, em situações de risco à vida ou à saúde, a Hi Scoot pode informar os dados de identificação estritamente necessários às autoridades de saúde e de segurança pública (art. 7º, VII, da LGPD).",
        ],
      },
      {
        title: "5. Com quem compartilhamos",
        paragraphs: [
          "Com a outra pessoa da reserva, só o necessário: o nome curto e as avaliações aparecem no perfil; telefone e e-mail só depois que a reserva é aceita; o endereço exato de retirada só depois do pagamento.",
          "Com o Mercado Pago, para processar pagamentos, divisões e devoluções.",
          "Com fornecedores que mantêm a plataforma funcionando: Supabase (banco de dados, login e arquivos), Vercel (hospedagem do site) e OpenStreetMap (mapas). Alguns desses fornecedores podem guardar dados fora do Brasil, com as garantias do art. 33 da LGPD.",
          "Com o Google (Gemini), quando você escreve na Central de ajuda: as mensagens do atendimento são enviadas ao assistente virtual de IA para gerar respostas automáticas. Nesse uso gratuito, o Google pode usar essas mensagens para melhorar os produtos dele. Por isso, não envie documentos, senhas ou dados de cartão no chat. SOS não passa pela IA.",
          "Com autoridades públicas: por ordem judicial, por obrigação legal ou para proteger a vida e a saúde de alguém, como descrito no item 4.",
          "Não vendemos dados pessoais.",
        ],
      },
      {
        title: "6. Por quanto tempo guardamos",
        paragraphs: [
          "Enquanto a conta estiver ativa, guardamos os dados necessários para prestar o serviço.",
          "Os registros de acesso à aplicação são guardados por, no mínimo, 6 meses (art. 15 do Marco Civil da Internet).",
          "Depois da exclusão da conta, por segurança, os demais dados ficam guardados pelo prazo necessário para cumprir obrigações legais e para o exercício regular de direitos, em regra por até [prazo a definir com o jurídico, ex.: 5 anos] (art. 16 da LGPD). Ao fim do prazo, são eliminados ou anonimizados.",
        ],
      },
      {
        title: "7. Exclusão da conta",
        paragraphs: [
          "Você pode excluir sua conta em Configurações, desde que não tenha reservas em andamento.",
          "Com a exclusão, a conta deixa de funcionar, o perfil público e os anúncios saem da plataforma e a conexão com o Mercado Pago é desfeita.",
          "Os dados guardados por segurança (item 6) ficam bloqueados e só podem ser fornecidos à Justiça brasileira, mediante ordem judicial (arts. 10 e 22 do Marco Civil da Internet).",
        ],
      },
      {
        title: "8. Seus direitos",
        paragraphs: [
          "Pelo art. 18 da LGPD, você pode pedir: confirmação de que tratamos seus dados; acesso aos dados; correção de dados incompletos ou errados; anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei; portabilidade; informação sobre com quem compartilhamos; e revisão de decisões automatizadas.",
          "Alguns dados podem continuar guardados mesmo após um pedido de eliminação, quando a lei permite ou exige (item 6).",
          "Para exercer seus direitos, escreva para [e-mail do encarregado]. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).",
        ],
      },
      {
        title: "9. Como protegemos seus dados",
        paragraphs: [
          "O acesso aos dados é controlado no próprio banco de dados: cada pessoa só vê o que é dela ou o que a reserva permite.",
          "Documentos de identidade ficam numa área privada que só a equipe de verificação abre, por links que valem 5 minutos. As chaves das contas Mercado Pago só são lidas pelo servidor do site.",
          "A conexão com o site é sempre protegida (HTTPS).",
        ],
      },
      {
        title: "10. Cookies",
        paragraphs: [
          "Usamos só cookies necessários para o site funcionar: manter você conectado e lembrar o idioma escolhido. Não usamos cookies de publicidade.",
        ],
      },
      {
        title: "11. Crianças e adolescentes",
        paragraphs: ["A plataforma é destinada a pessoas com pelo menos 18 (dezoito) anos."],
      },
      {
        title: "12. Mudanças nesta Política",
        paragraphs: [
          "Esta Política pode mudar. Quando houver mudança importante, avisaremos na plataforma antes de ela valer.",
        ],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    updated: "Draft of October 19, 2026",
    intro: [
      "This Policy explains which personal data Hi Scoot processes, why, who we share it with, how long we keep it and how you can exercise your rights, under the Brazilian General Data Protection Law (Law No. 13,709/2018, \"LGPD\") and the Brazilian Internet Civil Framework (Law No. 12,965/2014).",
    ],
    sections: [
      {
        title: "1. Who is responsible for your data",
        paragraphs: [
          "Controller: [company name], CNPJ [number], headquartered at [address].",
          "Data protection officer (art. 41 of the LGPD): [name], at [DPO email].",
        ],
      },
      {
        title: "2. Data we process",
        paragraphs: [
          "Sign-up: full name, email, phone number, city and password (stored encrypted by the login provider).",
          "Identity verification: photos or PDF of the front and back of an official photo ID, or a handwritten letter with social name and CPF.",
          "Mercado Pago account: account identifier and the access keys Mercado Pago provides when you authorize Hi Scoot. We never receive or store card numbers.",
          "Listings: photos, description, price, times, pickup address and equipment location.",
          "Bookings and payments: dates, amounts, booking and payment status, PIX codes and refunds.",
          "Pickup and return: photos of the equipment and the label code scanned by the Rider.",
          "Messages, reviews and notifications exchanged on the platform.",
          "Application access logs (IP address, date and time), as required by art. 15 of the Internet Civil Framework.",
        ],
      },
      {
        title: "3. Why we process data and the legal basis",
        paragraphs: [
          "Providing the service (creating the account, publishing listings, bookings, payments, pickup, return and reviews): performance of a contract (art. 7, V).",
          "Verifying identity and keeping people safe: protection of the life and physical safety of the data subject or third parties (art. 7, VII), fraud prevention and legitimate interest (art. 7, IX).",
          "Keeping access logs and meeting legal and regulatory obligations: compliance with a legal obligation (art. 7, II).",
          "Defending rights in judicial, administrative or arbitration proceedings: regular exercise of rights (art. 7, VI).",
        ],
      },
      {
        title: "4. Safety of people and society",
        paragraphs: [
          "For the safety of the people who use the platform and of society, providing the identification data requested by the platform is required. Hi Scoot manages the connection between Host and Rider and needs to know who is on each side of every rental.",
          "Each person is responsible for their own actions. Even so, accidents can happen, and immediately identifying the user can be important for their well-being: for example, to notify family members or to help emergency care.",
          "Therefore, when someone's life or health is at risk, Hi Scoot may share the strictly necessary identification data with health and public safety authorities (art. 7, VII, of the LGPD).",
        ],
      },
      {
        title: "5. Who we share data with",
        paragraphs: [
          "With the other person in the booking, only what is needed: the short name and reviews appear on the profile; phone and email only after the booking is accepted; the exact pickup address only after payment.",
          "With Mercado Pago, to process payments, splits and refunds.",
          "With providers that keep the platform running: Supabase (database, login and files), Vercel (website hosting) and OpenStreetMap (maps). Some of these providers may store data outside Brazil, with the safeguards of art. 33 of the LGPD.",
          "With Google (Gemini), when you write in the Help center: support messages are sent to the AI virtual assistant to generate automatic answers. On this free use, Google may use these messages to improve its products. So don't send IDs, passwords or card details in the chat. SOS doesn't go through the AI.",
          "With public authorities: upon a court order, by legal obligation or to protect someone's life and health, as described in section 4.",
          "We do not sell personal data.",
        ],
      },
      {
        title: "6. How long we keep data",
        paragraphs: [
          "While the account is active, we keep the data needed to provide the service.",
          "Application access logs are kept for at least 6 months (art. 15 of the Internet Civil Framework).",
          "After the account is deleted, for safety, the other data is kept for as long as needed to meet legal obligations and to exercise rights, as a rule for up to [period to be defined with legal counsel, e.g. 5 years] (art. 16 of the LGPD). At the end of the period, it is deleted or anonymized.",
        ],
      },
      {
        title: "7. Deleting your account",
        paragraphs: [
          "You can delete your account in Settings, as long as you have no ongoing bookings.",
          "Once deleted, the account stops working, the public profile and listings are removed from the platform and the Mercado Pago connection is undone.",
          "Data kept for safety (section 6) is locked and may only be provided to the Brazilian courts, upon a court order (arts. 10 and 22 of the Internet Civil Framework).",
        ],
      },
      {
        title: "8. Your rights",
        paragraphs: [
          "Under art. 18 of the LGPD, you may request: confirmation that we process your data; access to the data; correction of incomplete or wrong data; anonymization, blocking or deletion of unnecessary data or data processed unlawfully; portability; information about who we share data with; and review of automated decisions.",
          "Some data may remain stored even after a deletion request, when the law allows or requires it (section 6).",
          "To exercise your rights, write to [DPO email]. You may also file a complaint with the National Data Protection Authority (ANPD).",
        ],
      },
      {
        title: "9. How we protect your data",
        paragraphs: [
          "Access to data is controlled in the database itself: each person only sees what is theirs or what the booking allows.",
          "Identity documents are kept in a private area that only the verification team opens, through links valid for 5 minutes. Mercado Pago account keys are read only by the website server.",
          "The connection to the website is always secure (HTTPS).",
        ],
      },
      {
        title: "10. Cookies",
        paragraphs: [
          "We only use cookies needed for the website to work: keeping you signed in and remembering your language. We do not use advertising cookies.",
        ],
      },
      {
        title: "11. Children and teenagers",
        paragraphs: ["The platform is intended for people who are at least 18 (eighteen) years old."],
      },
      {
        title: "12. Changes to this Policy",
        paragraphs: ["This Policy may change. When there is an important change, we will announce it on the platform before it takes effect."],
      },
    ],
  },
};
