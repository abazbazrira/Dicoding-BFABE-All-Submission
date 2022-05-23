// mengimpor dotenv dan menjalankan konfigurasinya

const Hapi = require('@hapi/hapi');
const Jwt = require('@hapi/jwt');
const Inert = require('@hapi/inert');
const path = require('path');

// albums
const albums = require('./api/albums');
const AlbumsService = require('./services/postgres/AlbumsService');
const AlbumsValidator = require('./validator/albums');

// songs
const songs = require('./api/songs');
const SongsService = require('./services/postgres/SongsService');
const SongsValidator = require('./validator/songs');

// playlists
const playlists = require('./api/playlists');
const PlaylistsService = require('./services/postgres/PlaylistsService');
const PlaylistsValidator = require('./validator/playlists');

// playlist songs
const playlistSongs = require('./api/playlistSongs');
const PlaylistSongsService = require('./services/postgres/PlaylistSongsService');
const PlaylistSongsValidator = require('./validator/playlistSongs');

// playlist song activities
const PlaylistSongActivitiesService = require('./services/postgres/PlaylistSongActivitiesService');

// collaborations
const collaborations = require('./api/collaborations');
const CollaborationsService = require('./services/postgres/CollaborationsService');
const CollaborationsValidator = require('./validator/collaborations');

// users
const users = require('./api/users');
const UsersService = require('./services/postgres/UsersService');
const UsersValidator = require('./validator/users');

// authentications
const authentications = require('./api/authentications');
const AuthenticationsService = require('./services/postgres/AuthenticationsService');
const TokenManager = require('./tokenize/TokenManager');
const AuthenticationsValidator = require('./validator/authentications');

// exports
const exportsPlugin = require('./api/exports');
const ExportsValidator = require('./validator/exports');
const ProducerService = require('./services/rabbitmq/ProducerService');

// uploads
const uploadsPlugin = require('./api/uploads');
const UploadsValidator = require('./validator/uploads');
const StorageService = require('./services/storage/StorageService');

// redis cache
const CacheService = require('./services/redis/CacheService');

// configuration
const { SERVER_CONFIG, JWT_CONFIG } = require('./config');
// extensions
const { extensionsPlugin } = require('./api/extensions');

const init = async () => {
  // path
  const storagePath = path.resolve(__dirname, 'api/uploads/file/pictures');

  // services
  const cacheService = new CacheService();
  const collaborationsService = new CollaborationsService();
  const songsService = new SongsService(cacheService);
  const albumsService = new AlbumsService(songsService, cacheService);
  const usersService = new UsersService();
  const playlistSongActivitiesService = new PlaylistSongActivitiesService();
  const playlistsService = new PlaylistsService(
    songsService,
    collaborationsService
  );
  const playlistSongsService = new PlaylistSongsService(
    playlistSongActivitiesService,
    cacheService
  );
  const authenticationsService = new AuthenticationsService();
  const storageService = new StorageService(storagePath, albumsService);

  const server = Hapi.server({
    port: SERVER_CONFIG.PORT,
    host: SERVER_CONFIG.HOST,
    routes: {
      cors: {
        origin: ['*'],
      },
    },
  });

  // registrasi plugin eksternal
  await server.register([
    {
      plugin: Jwt,
    },
    {
      plugin: Inert,
    },
  ]);

  // mendefinisikan strategy autentikasi jwt
  server.auth.strategy(
    JWT_CONFIG.AUTH_STRATEGY_NAME,
    JWT_CONFIG.AUTH_STRATEGY_SCHEME,
    JWT_CONFIG.AUTH_STRATEGY_OPTIONS
  );

  await server.register([
    {
      plugin: albums,
      options: {
        service: albumsService,
        validator: AlbumsValidator,
      },
    },
    {
      plugin: songs,
      options: {
        service: songsService,
        validator: SongsValidator,
      },
    },
    {
      plugin: users,
      options: {
        service: usersService,
        validator: UsersValidator,
      },
    },
    {
      plugin: playlists,
      options: {
        playlistsService,
        playlistSongActivitiesService,
        validator: PlaylistsValidator,
      },
    },
    {
      plugin: playlistSongs,
      options: {
        playlistSongsService,
        playlistsService,
        songsService,
        validator: PlaylistSongsValidator,
      },
    },
    {
      plugin: collaborations,
      options: {
        usersService,
        collaborationsService,
        playlistsService,
        validator: CollaborationsValidator,
      },
    },
    {
      plugin: authentications,
      options: {
        authenticationsService,
        usersService,
        tokenManager: TokenManager,
        validator: AuthenticationsValidator,
      },
    },
    {
      plugin: exportsPlugin,
      options: {
        exportsService: ProducerService,
        playlistsService,
        validator: ExportsValidator,
      },
    },
    {
      plugin: uploadsPlugin,
      options: {
        service: storageService,
        validator: UploadsValidator,
      },
    },
    {
      plugin: extensionsPlugin,
    },
  ]);

  await server.start();
  console.log(`Server berjalan pada ${server.info.uri}`);
};

init();