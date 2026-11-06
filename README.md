# Agenda Inteligente

Sistema de agendamento para estabelecimentos, com dashboard, agenda, cadastros e reserva pública de horários. O projeto usa Next.js, React e Supabase.

## Recursos

- Dashboard com dados reais do estabelecimento.
- Agenda com criação, edição e atualização de status.
- Cadastro de clientes, profissionais e serviços.
- Acesso por proprietário, gerente e profissional.
- Link público para clientes solicitarem um horário sem criar conta.
- Atalho para compartilhar mensagens de confirmação/cancelamento pelo WhatsApp.
- Envio transacional de e-mail preparado para ativação no final da configuração.

## Executar localmente

1. Instale as dependências com `npm install`.
2. Crie `.env.local` na raiz do projeto e informe:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA
```

3. Inicie o app com `npm run dev` e abra [http://localhost:3000](http://localhost:3000).

## Preparar o Supabase

No SQL Editor do projeto Supabase, execute os scripts da pasta `supabase` nesta ordem:

1. `role_based_access.sql` — permissões por papel.
2. `link_professional_user.sql` — vínculo de uma conta de profissional ao perfil cadastrado.
3. `establishment_booking_settings.sql` — permite que proprietários e gerentes editem os dados públicos do estabelecimento.
4. `public_booking.sql` — RPCs e regras para agendamento público.
5. `appointment_overlap_guard.sql` — bloqueia conflitos de horário em reservas públicas e lançamentos pela agenda.

O estabelecimento precisa ter um `slug` preenchido para criar o link público. Profissionais, serviços e horários precisam estar ativos/cadastrados para que apareçam opções de reserva.

## Rotas principais

- `/` — dashboard após entrar.
- `/agenda` — agenda e horários de atendimento.
- `/clientes`, `/profissionais` e `/servicos` — cadastros.
- `/relatorios` — indicadores e exportação.
- `/configuracoes` — perfil e senha.
- `/agendar/SLUG-DO-ESTABELECIMENTO` — reserva pública.

## Verificações locais

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Publicação

Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no ambiente da hospedagem e faça o deploy. Nunca coloque chaves `service_role` no navegador ou em variáveis `NEXT_PUBLIC_`.

### Etapa final: ativar e-mail

O envio automático após confirmar ou cancelar um agendamento depende do Resend. Quando for configurar essa etapa, siga [`docs/email-notifications.md`](docs/email-notifications.md) e cadastre as variáveis `RESEND_API_KEY` e `RESEND_FROM_EMAIL` no servidor local e na hospedagem.


