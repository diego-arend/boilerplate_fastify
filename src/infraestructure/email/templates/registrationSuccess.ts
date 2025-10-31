/**
 * Registration Success Email Template (Brazilian Portuguese)
 */

import type { TemplateResult } from './types';
import { BaseTemplate } from './types';

interface RegistrationSuccessVariables {
  userName: string;
}

export class RegistrationSuccessTemplate extends BaseTemplate<RegistrationSuccessVariables> {
  getRequiredVariables(): string[] {
    return ['userName'];
  }

  render(variables: RegistrationSuccessVariables): TemplateResult {
    this.validateVariables(variables);

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Cadastro Realizado com Sucesso</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0;
            background-color: #f4f4f4;
          }
          .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header { 
            background: linear-gradient(135deg, #28a745, #20c997); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .content { 
            padding: 30px 20px; 
            text-align: center;
          }
          .success-icon {
            width: 80px;
            height: 80px;
            background: #28a745;
            border-radius: 50%;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            color: white;
          }
          .message {
            font-size: 18px;
            color: #2c3e50;
            margin: 20px 0;
            font-weight: 500;
          }
          .description {
            font-size: 16px;
            color: #6c757d;
            margin: 20px 0;
            line-height: 1.8;
          }
          .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
          }
          .brand {
            color: #28a745;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Parabéns, ${variables.userName}!</h1>
          </div>
          <div class="content">
            <div class="success-icon">✓</div>
            <div class="message">
              Parabéns, seu cadastro foi realizado na plataforma com sucesso!
            </div>
            <div class="description">
              Olá <strong>${variables.userName}</strong>,<br><br>
              
              Ficamos muito felizes em tê-lo(a) conosco! Seu cadastro foi processado 
              e sua conta está agora ativa em nossa plataforma.<br><br>
              
              Você já pode começar a explorar todos os recursos disponíveis e 
              aproveitar ao máximo nossa plataforma.<br><br>
              
              Se precisar de ajuda ou tiver alguma dúvida, nossa equipe de suporte 
              está sempre disponível para ajudá-lo(a).
            </div>
          </div>
          <div class="footer">
            Seja bem-vindo(a) à nossa <span class="brand">Plataforma</span>!<br>
            Este email foi enviado automaticamente, não é necessário responder.
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      🎉 Parabéns, ${variables.userName}!

      Parabéns, seu cadastro foi realizado na plataforma com sucesso!

      Olá ${variables.userName},

      Ficamos muito felizes em tê-lo(a) conosco! Seu cadastro foi processado 
      e sua conta está agora ativa em nossa plataforma.

      Você já pode começar a explorar todos os recursos disponíveis e 
      aproveitar ao máximo nossa plataforma.

      Se precisar de ajuda ou tiver alguma dúvida, nossa equipe de suporte 
      está sempre disponível para ajudá-lo(a).

      Seja bem-vindo(a) à nossa Plataforma!

      ---
      Este email foi enviado automaticamente, não é necessário responder.
    `;

    return {
      html,
      text: text.trim(),
      subject: `🎉 Parabéns ${variables.userName}! Seu cadastro foi realizado com sucesso`
    };
  }
}
