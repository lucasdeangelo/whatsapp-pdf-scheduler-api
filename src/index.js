const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// Configurações
const config = {
  groupName: "Creio são marcos",
  pdfPath: "./src/pdfs/19-03_-_Misericrdia.pdf",
  schedule: "00 6 * * *",
  sessionPath: "./.wwebjs_auth" // Pasta para salvar a sessão
};

// Client com autenticação persistente
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: config.sessionPath }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--unhandled-rejections=strict'
    ]
  }
});

// Evento QR Code (só na primeira execução)
client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
  console.log('Escaneie o QR Code uma vez. Após isso, a sessão será salva automaticamente!');
});

// Evento de autenticação bem-sucedida
client.on('authenticated', () => {
  console.log('Autenticado! A sessão foi salva.');
});

// Evento ready
client.on('ready', () => {
  console.log('Client está pronto!');
  
  // Agenda o envio
  const task = cron.schedule(config.schedule, async () => {
    try {
      await sendPDF();
      console.log('PDF enviado com sucesso!');
    } catch (error) {
      console.error('Erro ao enviar:', error);
    }
  });

  console.log(`Próximo envio: ${task.nextDate().toString()}`);
});

// Função de envio
async function sendPDF() {
    try {
      console.log('[1/5] Iniciando envio...');
      
      // Aguarda carregamento
      console.log('[2/5] Aguardando carregamento de chats...');
      await new Promise(resolve => setTimeout(resolve, 15000));
  
      // Busca chats
      console.log('[3/5] Buscando todos os chats...');
      const chats = await client.getChats();
      console.log('Chats encontrados:', chats.map(c => `${c.name} (${c.id.user})`));
  
      // Encontra contato
      console.log(`[4/5] Procurando por: ${config.groupName}`);
      const chat = chats.find(c => c.name === config.groupName);
      
      if (!chat) {
        throw new Error('Contato não encontrado');
      }
  
      console.log(`[5/5] Contato encontrado! ID: ${chat.id.user}`);
              
      // Envia PDF
      console.log('Enviando PDF...');
      // 1. Verifica se o arquivo existe
      const pdfPath = path.resolve(config.pdfPath);
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`Arquivo não encontrado: ${pdfPath}`);
      }
  
      // 2. Configurações do documento
      const documentOptions = {
        caption: 'Bom dia gente, se o meu programa deu certo, vocês vão receber o devocional de hoje as 06:00, espero que gostem (e meu programa funcione)',
        mimetype: 'application/pdf'
      };
  
      // 3. Envia com mediaType explícito
      const media = MessageMedia.fromFilePath(pdfPath);
      await chat.sendMessage(media, {
        caption: documentOptions.caption,
        filename: documentOptions.filename,
        mediaType: 'document' // Força o envio como documento
      });
  
      console.log('✅ Todos os envios concluídos!');
      
    } catch (error) {
      console.error('🔥 ERRO CRÍTICO:', error);
      throw error;
    }
  }

// Inicia o cliente
client.initialize();