# Pulse Messenger

Мессенджер на React и Firebase Realtime Database: регистрация по email, эмодзи-аватары, личные чаты и каналы с перепиской в реальном времени, аудио/видеозвонки и админ-панель с галочками для аккаунтов и каналов. Подарки и монеты работают без Cloud Functions и без Blaze.

## Запуск

```bash
npm install
npm run dev
```

Firebase Web config уже добавлен в `src/firebase.js`. В Firebase Console включите:

1. **Authentication → Sign-in method → Email/Password**.
2. **Realtime Database** в регионе `europe-west1`.
3. В разделе Realtime Database → Rules опубликуйте `database.rules.json`. Правила проверяют администратора по Firebase custom claim, запрещают подделывать подарки, ограничивают получение подарка одним разом и разрешают начислять по 10 монет не чаще раза в час.

Для звонков нужны разрешение на микрофон/камеру и HTTPS (GitHub Pages подходит). STUN используется для базового соединения; в некоторых сетях для надёжных звонков понадобится собственный TURN-сервер.

## Администратор и значок

Назначить начального администратора может только владелец Firebase-проекта через Firebase Admin SDK. Скачайте service-account JSON из Firebase Console → Project settings → Service accounts, затем локально выполните:

```bash
npm install firebase-admin
node scripts/set-admin.mjs admin@example.com path/to/service-account.json
```

Не добавляйте service-account JSON в репозиторий или в клиентское приложение. Выйдите из приложения и войдите снова. После этого появится панель управления, где можно выдавать и снимать verified badge у пользователей и каналов, а также выдавать подарки. Изображение значка находится в `public/verifybadge.png`.

## Публикация на GitHub Pages

React/Vite исходники находятся в архиве `pulse-source.zip`. GitHub Actions распаковывает его, собирает сайт и публикует GitHub Pages. В **Settings → Pages → Build and deployment** выберите **GitHub Actions**. В Firebase Authentication → Settings → Authorized domains добавьте домен GitHub Pages.

## Подарки и монеты без Blaze

Подарки нельзя купить: их может выдать только администратор, а получатель может забрать монеты один раз. Realtime Database Rules ограничивают выдачу администраторами, задают награду каждому типу подарка и не дают получить один подарок повторно. Часовые награды хранятся как серверно проверяемые последовательные начисления; пользователь может получить +10 монет только после истечения часа. Баланс вычисляется из почасовых начислений и забранных подарков. Cloud Functions и план Blaze не используются.

После изменения правил откройте Realtime Database → Rules, вставьте актуальное содержимое `database.rules.json` и нажмите **Publish**. Затем GitHub Actions пересоберёт и опубликует сайт.

## Безопасность

Firebase Web API key предназначен для клиентского приложения. Ограничения доступа обеспечивают Authentication и правила Realtime Database. Не публикуйте service-account JSON и другие приватные ключи.
