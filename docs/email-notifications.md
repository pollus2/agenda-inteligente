# Avisos de agendamento por e-mail

O app envia um e-mail transacional ao cliente quando um proprietário ou gerente muda o status de um agendamento para **Confirmado** ou **Cancelado**. O envio acontece no servidor pela API REST do Resend. Se o serviço ainda não estiver configurado, o status é atualizado normalmente e a agenda mantém o botão de WhatsApp.

## Configuração

1. Crie uma chave de API no Resend e verifique o domínio de envio.
2. No `.env.local`, adicione:

```env
RESEND_API_KEY=re_sua_chave
RESEND_FROM_EMAIL=Agenda Inteligente <agenda@seudominio.com>
```

3. Reinicie o servidor local. Em produção, configure as mesmas variáveis no painel do provedor de hospedagem e faça um novo deploy.

Mantenha `RESEND_API_KEY` somente no servidor. Não use o prefixo `NEXT_PUBLIC_` nessa variável.
