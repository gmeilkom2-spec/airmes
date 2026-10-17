# Pulse Messenger

Мессенджер на React и Firebase Realtime Database: регистрация по email, эмодзи-аватары, личные чаты и каналы с перепиской в реальном времени, аудио/видеозвонки и админ-панель с галочками для аккаунтов и каналов.

## Запуск

```bash
npm install
npm run dev
```

Firebase Web config уже добавлен в `src/firebase.js`. В Firebase Console включите:

1. **Authentication → Sign-in method → Email/Password**.
2. **Realtime Database** в регионе `europe-west1`.
3. В разделе Realtime Database → Rules вставьте актуальное содержимое `database.rules.json` из этого репозитория и нажмите **Publish**. Новые правила нужны для каталога каналов, подписок, публикаций и проверки галочек каналов. Хранилище файлов не требуется: профиль использует эмодзи-аватар.

Затем создайте двух пользователей и проверьте сообщения и звонки в разных браузерах/устройствах. Для звонков нужны разрешение на микрофон/камеру и HTTPS (GitHub Pages подходит). STUN используется для базового соединения; в некоторых сетях для надёжных звонков понадобится собственный TURN-сервер.

## Администратор и значок

Назначить начального администратора может только владелец Firebase-проекта через Firebase Admin SDK. Скачайте service-account JSON из Firebase Console → Project settings → Service accounts, затем локально выполните:

```bash
npm install firebase-admin
node scripts/set-admin.mjs admin@example.com path/to/service-account.json
```

Не добавляйте service-account JSON в репозиторий или в клиентское приложение. Выйдите из приложения и войдите снова. После этого появится панель управления, где можно выдавать и снимать verified badge у пользователей и каналов. Браузер не может самостоятельно назначить себе custom claim.

Изображение значка находится в `public/verifybadge.png`.

## Публикация на GitHub Pages

Исходный React/Vite-проект находится в репозитории и упакован в `pulse-source.zip`. Чтобы работать с исходниками локально, распакуйте архив и выполните команды из раздела «Запуск».

В **Settings → Pages → Build and deployment** выберите **GitHub Actions**. Workflow `.github/workflows/deploy.yml` установит зависимости прямо из репозитория, соберёт приложение из исходников и опубликует его автоматически. В Firebase Authentication → Settings → Authorized domains добавьте домен GitHub Pages.

## Заметки

- Firebase web API key предназначен для клиентского приложения; защиту доступа обеспечивают Firebase Rules и Authentication.
- Для доступа к списку пользователей приложение читает публичные поля профиля (имя, email, аватар и badge) только после входа.
- Реалтайм-аудио/видеозвонки используют WebRTC и Firebase для сигналинга. Ограничения NAT/firewall могут потребовать TURN.
