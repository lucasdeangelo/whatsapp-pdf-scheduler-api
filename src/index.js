const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const cron = require('node-cron');
const cors = require('cors');

const app = express();

// Configuração do Multer para salvar arquivos com nome original
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, 'uploads'); // Caminho absoluto
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir); // Usa caminho absoluto
  },
  filename: (req, file, cb) => {
    const normalizedName = file.originalname
      .replace(/\s+/g, '_')       // Substitui espaços por _
      .normalize('NFD')           // Remove acentos
      .replace(/[^\w.-]/g, '');   // Remove caracteres especiais
    cb(null, normalizedName);
  }
});

const upload = multer({ storage });

// Habilita CORS
app.use(cors());

// Configurações
const config = {
  sessionPath: './.wwebjs_auth',
  pdfPath: './documento.pdf'
};

// Cria a pasta 'uploads' se não existir
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Inicializa o cliente do WhatsApp
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: config.sessionPath }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox']
  }
});

client.on('qr', qr => {
  console.log('Escaneie o QR Code:', qr);
});

client.on('ready', () => {
  console.log('Client está pronto!');
});

client.initialize();

// Rota para agendar envio
app.post('/schedule', upload.single('pdf'), async (req, res) => {
  const { chatName, message, time } = req.body;

  // Caminho do arquivo salvo
  const pdfPath = path.join(
    __dirname,
    'uploads',
    req.file.filename
  );

  if (!fs.existsSync(pdfPath)) {
    return res.status(400).json({ success: false, error: 'Arquivo não encontrado.' });
  }

  // Agenda o envio
  const [hour, minute] = time.split(':');
  const cronTime = `${minute} ${hour} * * *`;

  cron.schedule(cronTime, async () => {
    try {
      // Busca o chat pelo nome
      const chats = await client.getChats();
      const chat = chats.find(c => c.name === chatName || c.id.user === chatName);

      if (!chat) {
        throw new Error(`Chat/Grupo "${chatName}" não encontrado.`);
      }

      // Envia o PDF
      const media = MessageMedia.fromFilePath(pdfPath);
      await chat.sendMessage(media, { caption: message });
      console.log(`PDF enviado com sucesso para ${chatName}!`);

      // Remove o arquivo após o envio
      fs.unlinkSync(pdfPath);
    } catch (error) {
      console.error('Erro ao enviar PDF:', error);
    }
  });

  res.json({ success: true, time });
});

// Inicia o servidor
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Backend rodando!`);
});