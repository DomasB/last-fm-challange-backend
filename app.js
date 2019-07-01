var express = require('express');
var graphqlHTTP = require('express-graphql');
const Database = require('better-sqlite3');
const db = new Database('./database/last-fm.db');
const {
    GraphQLSchema,
    GraphQLObjectType,
    GraphQLInt,
    GraphQLID,
    GraphQLString,
    GraphQLList
} = require('graphql')

// DB queries
const getArtistById = db.prepare("SELECT * FROM artists LEFT JOIN (SELECT local_artist_id, min(track_date) AS first_play FROM tracks GROUP BY local_artist_id) ON artist_id = local_artist_id WHERE artist_id = $id");
const getArtistByName = db.prepare("SELECT * FROM artists LEFT JOIN (SELECT local_artist_id, min(track_date) AS first_play FROM tracks GROUP BY local_artist_id) ON artist_id = local_artist_id WHERE artist_name = $name");
const getArtists = db.prepare("SELECT * FROM artists LEFT JOIN (SELECT  min(track_date) AS first_play, local_artist_id FROM tracks GROUP BY local_artist_id) ON artist_id = local_artist_id ORDER BY first_play DESC LIMIT $limit OFFSET $offset");
const getArtistsCount = db.prepare("SELECT COUNT(artist_id) AS artists_count FROM artists");
const getAlbumById = db.prepare("SELECT * FROM albums LEFT JOIN (SELECT local_album_id, min(track_date) AS first_play FROM tracks GROUP BY local_album_id) ON album_id = local_album_id WHERE album_id = $id");
const getAlbumByArtistId = db.prepare("SELECT * FROM albums LEFT JOIN (SELECT local_album_id, min(track_date) AS first_play FROM tracks GROUP BY local_album_id) ON album_id = local_album_id WHERE album_artist_id = $id");
const getAlbumTracksByAlbumId = db.prepare("SELECT  album_id , album_track_name, album_track_id, artist_name, track_url, track_duration, play_count, first_play FROM album_tracks t LEFT JOIN (SELECT COUNT(track_id) AS play_count, min(track_date) AS first_play, local_album_track_id FROM tracks GROUP BY local_album_track_id) ON local_album_track_id = album_track_id WHERE album_id = $id");
// Construct a schema, using GraphQL schema language
const ArtistType = new GraphQLObjectType({
    name: 'Artist',
    description: 'Artist information',
    fields: () =>  ({
        id: {
            type: GraphQLID,
            resolve: artist => artist.artist_id
        },
        name: {
            type: GraphQLString,
            resolve: artist => artist.artist_name
        },
        mbid: {
            type: GraphQLString,
            resolve: artist => artist.artist_mbid
        },
        url: {
            type: GraphQLString,
            resolve: artist => artist.artist_url
        },
        image: {
            type: GraphQLString,
            resolve: artist => artist.artist_image
        },
        firstPlay: {
            type: GraphQLInt,
            resolve: artist => artist.first_play
        },
        tags: {
            type: GraphQLList(GraphQLString),
            resolve: artist => JSON.parse(artist.artist_tags)
        },
        albums: {
            type: new GraphQLList(AlbumType),
            resolve: artist => getAlbumByArtistId.all({id: artist.artist_id})
        }
    })
});

const ArtistsType = new GraphQLObjectType({
    name: 'Artists',
    description: 'List of artists',
    fields: () => ({
      totalPages: {
        type: GraphQLInt,
        resolve: args => {
          const artistsCount = getArtistsCount.get().artists_count;
          return Math.ceil(artistsCount / args.limit)
        }
      },
      artists: {
        type: new GraphQLList(ArtistType),
        resolve: args => {
          const offset = args.page * args.limit;
          return getArtists.all({limit: args.limit, offset})
        }
      }
    })

});

const AlbumType = new GraphQLObjectType({
    name: 'Album',
    description: 'Album information',
    fields: () => ({
        id: {
            type: GraphQLID,
            resolve: album => album.album_id
        },
        name: {
            type: GraphQLString,
            resolve: album => album.album_name
        },
        mbid: {
            type: GraphQLString,
            resolve: album => album.album_mbid
        },
        url: {
            type: GraphQLString,
            resolve: album => album.album_url
        },
        image: {
            type: GraphQLString,
            resolve: album => album.album_image
        },
        firstPlay: {
            type: GraphQLInt,
            resolve: album => album.first_play
        },
        tags: {
            type: GraphQLList(GraphQLString),
            resolve: album => JSON.parse(album.album_tags)
        },
        artist: {
            type: ArtistType,
            resolve: album => getArtistById.get({id: album.album_artist_id})
        },
        tracks: {
            type: new GraphQLList(AlbumTrackType),
            resolve: album => getAlbumTracksByAlbumId.all({id: album.album_id})
        }
    })
});

const AlbumTrackType = new GraphQLObjectType({
    name: 'AlbumTrack',
    description: 'Track in the album, doesn\'t have to be listened',
    fields: () => ({
        id: {
            type: GraphQLID,
            resolve: albumTrack => albumTrack.album_track_id
        },
        album: {
            type: AlbumType,
            resolve: albumTrack => getAlbumById.get({id: albumTrack.album_id})
        },
        artist: {
            type: ArtistType,
            resolve: albumTrack => getArtistByName.get({name: albumTrack.artist_name})
        },
        name: {
            type: GraphQLString,
            resolve: albumTrack => albumTrack.album_track_name
        },
        url: {
            type: GraphQLString,
            resolve: albumTrack => albumTrack.track_url
        },
        duration: {
            type: GraphQLInt,
            resolve: albumTrack => albumTrack.track_duration
        },
        playCount: {
            type: GraphQLInt,
            resolve: albumTrack => albumTrack.play_count
        },
        firstPlay: {
            type: GraphQLInt,
            resolve: albumTrack => albumTrack.first_play
        }
    })
});

const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
        name:'Query',
        description: 'Base Query',
        fields: () => ({
            artist: {
                type: ArtistType,
                args: {
                    id: { type: GraphQLInt }
                },
                resolve: (global, args) => getArtistById.get({id: args.id})
            },
            artists: {
                type: ArtistsType,
                args: {
                    page: { type: GraphQLInt },
                    limit: { type: GraphQLInt }
                },
                resolve: (global, args) => { return args }
            },
            album: {
                type: AlbumType,
                args: {
                  id: { type: GraphQLInt }
                },
                resolve: (global, args) => getAlbumById.get({id: args.id})
            }
        })
    })
});

var app = express();
app.use('/graphql', graphqlHTTP({
    schema: schema,
    rootValue: global,
    graphiql: true,
}));
app.listen(4000);
console.log('Running a GraphQL API server at localhost:4000/graphql');
