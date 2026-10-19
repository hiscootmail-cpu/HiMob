import type { LegalDocument } from "@/lib/legal/types";

/*
 * Termos de Uso da Hi Scoot.
 * RASCUNHO escrito em 19/10/2026 com as regras já aprovadas da plataforma.
 * Precisa de revisão de um advogado antes do lançamento. Os campos entre
 * colchetes ainda precisam ser preenchidos.
 */

export const terms: Record<"pt" | "en", LegalDocument> = {
  pt: {
    title: "Termos de Uso",
    updated: "Rascunho de 19 de outubro de 2026",
    intro: [
      "Estes Termos explicam como funciona a Hi Scoot e as regras para alugar e anunciar patinetes e bikes elétricas na plataforma. Ao criar sua conta, você declara que leu e aceita estes Termos e a Política de Privacidade.",
    ],
    sections: [
      {
        title: "1. Quem somos",
        paragraphs: [
          "A Hi Scoot é uma plataforma operada por [razão social], inscrita no CNPJ sob o nº [número], com sede em [endereço] (\"Hi Scoot\").",
          "A Hi Scoot aproxima pessoas que querem alugar o próprio patinete ou bike elétrica (\"Host\") de pessoas que querem alugar (\"Rider\"). A mesma conta pode ser usada para as duas coisas.",
        ],
      },
      {
        title: "2. O que a plataforma faz",
        paragraphs: [
          "A Hi Scoot faz a gestão da conexão entre Host e Rider: anúncios, reservas, pagamento, conversa, retirada, devolução e avaliações.",
          "A Hi Scoot não é dona dos equipamentos anunciados e não é a locadora. O aluguel é combinado entre Host e Rider, pessoas independentes, nos termos do Código Civil (Lei nº 10.406/2002) e, quando aplicável, do Código de Defesa do Consumidor (Lei nº 8.078/1990).",
        ],
      },
      {
        title: "3. Cadastro e verificação de identidade",
        paragraphs: [
          "Para usar a plataforma, você precisa ter pelo menos [idade mínima a definir] anos e informar dados verdadeiros e atualizados: nome completo, e-mail, telefone com DDD e um documento oficial com foto (frente e verso).",
          "A equipe Hi Scoot confere se o nome do documento é o mesmo do cadastro. Pessoas trans com documento ainda não retificado podem enviar uma carta escrita à mão com o nome social e o CPF, analisada com sigilo.",
          "Depois do cadastro, é preciso conectar uma conta Mercado Pago. Para o Host, é por ela que chega o valor das reservas. Para o Rider, a conexão serve para identificar a conta; a Hi Scoot não movimenta o saldo de ninguém.",
          "Você é responsável por manter sua senha em segredo e por tudo o que for feito com a sua conta.",
        ],
      },
      {
        title: "4. Por que pedimos seus dados: segurança de todos",
        paragraphs: [
          "Para a segurança de quem usa a plataforma e da sociedade, é necessário fornecer os dados de identificação pedidos no cadastro. Como a Hi Scoot faz a gestão da conexão entre as pessoas, precisa saber quem está de cada lado de cada aluguel.",
          "Cada pessoa é responsável pelos próprios atos. Mesmo assim, acidentes podem acontecer, e a identificação imediata de quem estava usando o equipamento pode ser importante para o bem-estar dessa pessoa, por exemplo para avisar familiares ou ajudar no atendimento de emergência.",
          "Esse tratamento de dados tem base na Lei Geral de Proteção de Dados (Lei nº 13.709/2018), em especial na proteção da vida e da incolumidade física (art. 7º, VII), na execução do contrato (art. 7º, V) e no cumprimento de obrigações legais (art. 7º, II). Os detalhes estão na Política de Privacidade.",
        ],
      },
      {
        title: "5. Anúncios (Host)",
        paragraphs: [
          "Todo anúncio passa pela análise da equipe Hi Scoot antes de aparecer na busca. O Host define o preço por dia, os horários de retirada e devolução e o endereço de retirada.",
          "Um anúncio pode ser editado no máximo uma vez a cada 30 dias. A edição também passa pela análise; até a aprovação, o anúncio antigo continua no ar.",
          "O Host garante que o equipamento é dele (ou que tem autorização para alugar), está em boas condições de uso e segurança e corresponde às fotos e à descrição.",
          "O telefone, o e-mail e o endereço exato só são mostrados à outra pessoa depois que a reserva é aceita (contato) e paga (endereço).",
          "O Host cola no equipamento a etiqueta com o QR code da Hi Scoot, usada na retirada e na devolução.",
        ],
      },
      {
        title: "6. Reservas e pagamento",
        paragraphs: [
          "O aluguel é sempre por diária. O preço que o Rider vê já inclui a taxa da plataforma de 15% sobre o valor do Host.",
          "O Rider pede a reserva, o Host aceita ou recusa (com um motivo curto) e, depois de aceita, o Rider paga pelo Mercado Pago (PIX ou cartão de crédito à vista). A reserva só é confirmada quando o Mercado Pago confirma o pagamento.",
          "O valor é dividido automaticamente: as diárias vão para o Host e a taxa da plataforma fica com a Hi Scoot. A taxa do Mercado Pago é paga pela Hi Scoot.",
          "Dias já reservados ou bloqueados pelo Host não podem ser reservados.",
        ],
      },
      {
        title: "7. Cancelamento",
        paragraphs: [
          "Uma reserva pode ser cancelada até 24 horas antes do horário de retirada definido pelo Host. Antes do pagamento, cancelar não tem custo.",
          "Se o Rider cancela uma reserva paga, recebe de volta o valor das diárias; a taxa da plataforma não é devolvida.",
          "Se o Host cancela uma reserva paga, o Rider recebe tudo de volta (diárias e taxa) e a taxa da plataforma é cobrada do Host, descontada na próxima reserva paga dele.",
          "As devoluções são feitas pelo Mercado Pago, no mesmo meio de pagamento, nos prazos do Mercado Pago.",
        ],
      },
      {
        title: "8. Retirada e devolução",
        paragraphs: [
          "Na retirada e na devolução, o Rider lê o QR code da etiqueta e tira uma foto do equipamento, e o Host também tira uma foto. A reserva só segue para a próxima etapa quando os dois confirmam.",
          "Se uma das pessoas não confirmar em até 2 horas, a equipe Hi Scoot verifica o ocorrido, pode falar com as duas pessoas e pode confirmar pela plataforma, registrando o motivo.",
          "As fotos ficam guardadas de forma privada e servem de prova do estado do equipamento.",
        ],
      },
      {
        title: "9. Responsabilidades",
        paragraphs: [
          "Cada pessoa responde pelos próprios atos e pelos danos que causar, nos termos dos artigos 186 e 927 do Código Civil.",
          "O Rider se compromete a usar o equipamento com cuidado, só para fins lícitos, respeitando o Código de Trânsito Brasileiro (Lei nº 9.503/1997), as regras do CONTRAN para equipamentos de mobilidade individual autopropelidos e bicicletas elétricas (Resolução CONTRAN nº 996/2023) e as regras do seu município. O uso de capacete é fortemente recomendado.",
          "O Rider devolve o equipamento no dia e horário combinados, no mesmo estado em que recebeu, salvo o desgaste normal de uso.",
          "O Host é responsável pela manutenção e pela segurança do equipamento que anuncia.",
          "A Hi Scoot faz a gestão da conexão e colabora para resolver problemas, mas não responde pelos atos de Hosts e Riders, nem pelo estado dos equipamentos, ressalvados os casos previstos em lei.",
        ],
      },
      {
        title: "10. Acidentes e emergências",
        paragraphs: [
          "Em caso de acidente, procure ajuda imediatamente: SAMU 192, Polícia Militar 190, Corpo de Bombeiros 193.",
          "Depois, avise a equipe Hi Scoot pela plataforma ou pelo e-mail [e-mail de contato].",
          "Para proteger a vida e a saúde das pessoas envolvidas, a Hi Scoot pode informar os dados de identificação necessários às autoridades de saúde e de segurança pública, conforme a Política de Privacidade.",
        ],
      },
      {
        title: "11. Conduta, avaliações e bloqueio",
        paragraphs: [
          "Depois da devolução, Rider e Host podem se avaliar uma vez por reserva. As avaliações são públicas e precisam ser verdadeiras e respeitosas.",
          "É proibido: discriminar, assediar ou ameaçar; fraudar pagamentos ou documentos; tentar combinar pagamentos fora da plataforma; publicar contatos antes da reserva aceita; anunciar equipamento que não é seu.",
          "A Hi Scoot pode recusar anúncios, suspender ou bloquear contas que descumpram estes Termos ou a lei, informando o motivo sempre que possível.",
        ],
      },
      {
        title: "12. Exclusão da conta",
        paragraphs: [
          "Você pode excluir sua conta a qualquer momento em Configurações, desde que não tenha reservas em andamento.",
          "Depois da exclusão, sua conta deixa de funcionar, seu perfil e seus anúncios saem da plataforma e você não aparece mais para outras pessoas.",
          "Por segurança, os dados ficam guardados pelo prazo descrito na Política de Privacidade e só podem ser fornecidos à Justiça brasileira, mediante ordem judicial.",
        ],
      },
      {
        title: "13. Mudanças nestes Termos",
        paragraphs: [
          "Estes Termos podem mudar. Quando houver mudança importante, avisaremos na plataforma antes de ela valer.",
        ],
      },
      {
        title: "14. Lei aplicável e foro",
        paragraphs: [
          "Estes Termos seguem as leis brasileiras. Fica eleito o foro do domicílio do usuário, conforme o Código de Defesa do Consumidor, quando aplicável.",
        ],
      },
      {
        title: "15. Contato",
        paragraphs: ["Dúvidas sobre estes Termos: [e-mail de contato]."],
      },
    ],
  },
  en: {
    title: "Terms of Use",
    updated: "Draft of October 19, 2026",
    intro: [
      "These Terms explain how Hi Scoot works and the rules for renting and listing e-scooters and e-bikes on the platform. By creating your account, you confirm that you have read and accept these Terms and the Privacy Policy.",
    ],
    sections: [
      {
        title: "1. Who we are",
        paragraphs: [
          "Hi Scoot is a platform operated by [company name], registered under CNPJ [number], headquartered at [address] (\"Hi Scoot\").",
          "Hi Scoot connects people who want to rent out their own e-scooter or e-bike (\"Host\") with people who want to rent one (\"Rider\"). The same account can be used for both.",
        ],
      },
      {
        title: "2. What the platform does",
        paragraphs: [
          "Hi Scoot manages the connection between Host and Rider: listings, bookings, payment, messages, pickup, return and reviews.",
          "Hi Scoot does not own the listed equipment and is not the lessor. The rental is agreed between Host and Rider, independent people, under the Brazilian Civil Code (Law No. 10,406/2002) and, where applicable, the Consumer Protection Code (Law No. 8,078/1990).",
        ],
      },
      {
        title: "3. Sign-up and identity verification",
        paragraphs: [
          "To use the platform, you must be at least [minimum age to be defined] years old and provide true, up-to-date information: full name, email, phone number with area code and an official photo ID (front and back).",
          "The Hi Scoot team checks that the name on the ID matches the account. Trans people whose documents have not yet been updated may send a handwritten letter with their social name and CPF, reviewed confidentially.",
          "After signing up, you must connect a Mercado Pago account. For Hosts, this is where booking payments arrive. For Riders, the connection identifies the account; Hi Scoot never moves anyone's balance.",
          "You are responsible for keeping your password secret and for everything done with your account.",
        ],
      },
      {
        title: "4. Why we ask for your data: everyone's safety",
        paragraphs: [
          "For the safety of the people who use the platform and of society, providing the identification data requested at sign-up is required. Because Hi Scoot manages the connection between people, it needs to know who is on each side of every rental.",
          "Each person is responsible for their own actions. Even so, accidents can happen, and immediately identifying who was using the equipment can be important for that person's well-being, for example to notify family members or to help emergency care.",
          "This data processing is based on the Brazilian General Data Protection Law (Law No. 13,709/2018, LGPD), in particular the protection of life and physical safety (art. 7, VII), the performance of the contract (art. 7, V) and compliance with legal obligations (art. 7, II). Details are in the Privacy Policy.",
        ],
      },
      {
        title: "5. Listings (Host)",
        paragraphs: [
          "Every listing is reviewed by the Hi Scoot team before it appears in search. The Host sets the daily price, the pickup and return times and the pickup address.",
          "A listing can be edited at most once every 30 days. Edits are also reviewed; until approval, the previous listing stays live.",
          "The Host guarantees that the equipment is theirs (or that they are authorized to rent it out), is in good working and safe condition and matches the photos and description.",
          "Phone, email and exact address are shown to the other person only after the booking is accepted (contact) and paid (address).",
          "The Host attaches the Hi Scoot QR code label to the equipment, used at pickup and return.",
        ],
      },
      {
        title: "6. Bookings and payment",
        paragraphs: [
          "Rentals are always by the day. The price the Rider sees already includes the 15% platform fee on the Host's price.",
          "The Rider requests a booking, the Host accepts or declines (with a short reason) and, once accepted, the Rider pays through Mercado Pago (PIX or credit card in a single installment). The booking is confirmed only when Mercado Pago confirms the payment.",
          "The amount is split automatically: the daily rates go to the Host and the platform fee stays with Hi Scoot. The Mercado Pago fee is paid by Hi Scoot.",
          "Days already booked or blocked by the Host cannot be booked.",
        ],
      },
      {
        title: "7. Cancellation",
        paragraphs: [
          "A booking can be cancelled up to 24 hours before the pickup time set by the Host. Before payment, cancelling is free.",
          "If the Rider cancels a paid booking, they get the daily rates back; the platform fee is not refunded.",
          "If the Host cancels a paid booking, the Rider gets everything back (daily rates and fee) and the platform fee is charged to the Host, deducted from their next paid booking.",
          "Refunds are made by Mercado Pago, to the same payment method, within Mercado Pago's time frames.",
        ],
      },
      {
        title: "8. Pickup and return",
        paragraphs: [
          "At pickup and return, the Rider scans the QR code on the label and takes a photo of the equipment, and the Host also takes a photo. The booking moves to the next step only when both confirm.",
          "If one of them does not confirm within 2 hours, the Hi Scoot team checks what happened, may talk to both people and may confirm on behalf of the platform, recording the reason.",
          "The photos are stored privately and serve as proof of the equipment's condition.",
        ],
      },
      {
        title: "9. Responsibilities",
        paragraphs: [
          "Each person is liable for their own actions and for any damage they cause, under articles 186 and 927 of the Civil Code.",
          "The Rider agrees to use the equipment carefully, only for lawful purposes, following the Brazilian Traffic Code (Law No. 9,503/1997), the CONTRAN rules for self-propelled personal mobility devices and electric bicycles (CONTRAN Resolution No. 996/2023) and local city rules. Wearing a helmet is strongly recommended.",
          "The Rider returns the equipment on the agreed day and time, in the same condition it was received, except for normal wear.",
          "The Host is responsible for the maintenance and safety of the equipment they list.",
          "Hi Scoot manages the connection and helps solve problems, but is not liable for the actions of Hosts and Riders or for the condition of the equipment, except as provided by law.",
        ],
      },
      {
        title: "10. Accidents and emergencies",
        paragraphs: [
          "In case of an accident, seek help immediately: SAMU 192, Military Police 190, Fire Department 193.",
          "Then let the Hi Scoot team know through the platform or by email at [contact email].",
          "To protect the life and health of the people involved, Hi Scoot may share the necessary identification data with health and public safety authorities, as described in the Privacy Policy.",
        ],
      },
      {
        title: "11. Conduct, reviews and blocking",
        paragraphs: [
          "After the return, Rider and Host may review each other once per booking. Reviews are public and must be truthful and respectful.",
          "It is forbidden to: discriminate, harass or threaten; commit payment or document fraud; try to arrange payments outside the platform; post contact details before the booking is accepted; list equipment that is not yours.",
          "Hi Scoot may decline listings and suspend or block accounts that break these Terms or the law, stating the reason whenever possible.",
        ],
      },
      {
        title: "12. Deleting your account",
        paragraphs: [
          "You can delete your account at any time in Settings, as long as you have no ongoing bookings.",
          "After deletion, your account stops working, your profile and listings are removed from the platform and you are no longer shown to other people.",
          "For safety, the data is kept for the period described in the Privacy Policy and may only be provided to the Brazilian courts, upon a court order.",
        ],
      },
      {
        title: "13. Changes to these Terms",
        paragraphs: ["These Terms may change. When there is an important change, we will announce it on the platform before it takes effect."],
      },
      {
        title: "14. Governing law and jurisdiction",
        paragraphs: [
          "These Terms are governed by Brazilian law. The courts of the user's place of residence have jurisdiction, as provided by the Consumer Protection Code, where applicable.",
        ],
      },
      {
        title: "15. Contact",
        paragraphs: ["Questions about these Terms: [contact email]."],
      },
    ],
  },
};
