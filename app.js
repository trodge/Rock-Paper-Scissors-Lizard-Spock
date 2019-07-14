


$(function () {
    // Your web app's Firebase configuration
    var firebaseConfig = {
        apiKey: 'AIzaSyD2sMCdPdMSipTpb2cl81XASLmAG7cfckM',
        authDomain: 'rock-paper-scissors-e69d4.firebaseapp.com',
        databaseURL: 'https://rock-paper-scissors-e69d4.firebaseio.com',
        projectId: 'rock-paper-scissors-e69d4',
        storageBucket: '',
        messagingSenderId: '529053111667',
        appId: '1:529053111667:web:14934373b2cbe67e'
    };
    // Initialize Firebase.
    firebase.initializeApp(firebaseConfig);
    var database = firebase.database();
    var chatRef = database.ref('chat');

    chatRef.on('value', function(snapshot) {
        messages = snapshot.val();
        var chatBox = $('#chat');
        chatBox.empty();
        for (item in messages)
            chatBox.append(messages[item] + '<br>');
    });

    var playersRef = database.ref('players'); // reference to players in database
    playersRef.once('value').then(function (snapshot) {
        // Load initial data from database.
        var playerNumber, playerCount = 0;
        var players = snapshot.val();
        var ourKey, matchKey;
        for (other in players) {
            player = players[other]
            if (player.status === 'disconnected') {
                if (!ourKey && player.name.substring(0, 7) === 'Player ') {
                    // Take this disconnected player's name.
                    ourKey = other;
                    ourName = player.name;
                }
            } else {
                ++playerCount;
                if (!matchKey && player.status === 'seeking')
                    // Intend to match with other.
                    matchKey = other;
            }
        }
        // Increase player count to count this player.
        playerNumber = ++playerCount;
        var ourName = 'Player ' + String(playerNumber);
        $('#player-name').val(ourName);
        $('#chat-input').keydown(function(event) {
            if (event.key === 'Enter') {
                chatRef.push(ourName + ': ' + $(this).val());
                $(this).val('');
            }
        });
        if (!ourKey)
            // Add a new player to database.
            ourKey = playersRef.push({ name: ourName }).key;
        var ourRef = database.ref('players/' + ourKey);
        ourRef.update({
            status: 'seeking',
            opponent: matchKey ? matchKey : null
        });
        var matchRef; // will be reference to opponent in database
        var matchName; // will hold opponent's name from database

        const choices = ['scissors', 'paper', 'rock', 'lizard', 'spock'];

        var ourChoice, matchChoice, matchReady;

        function completeGame() {
            // Function to call when both players have chosen.
            ourRef.update({ choice: ourChoice });
            matchRef.off();
            // Listen for opponent's choice on database
            matchRef.on('value', function (snapshot) {
                var match = snapshot.val();
                console.log(match);
                if (match.choice) {
                    matchChoice = Number(match.choice);
                    var difference = matchChoice - ourChoice;
                    $('#result').append('You chose ' + choices[ourChoice] + ' and ' + matchName + ' chose ' + choices[matchChoice] + '.<br>' +
                        (difference ? difference % 2 ^ difference > 0 ? 'You lose!' : 'You win!' : 'Draw!') + '<br>');
                    matchRef.update({ choice: null });
                    matchRef.off();
                }
            });
        }

        function createChoiceButtons() {
            $('#top').text('Playing against ' + matchName);
            var div = $('#choice-buttons');
            div.empty();
            for (var i = 0; i < choices.length; ++i)
                div.append($('<button>')
                    .attr({ 'class': 'btn btn-primary', 'choice-id': i })
                    .css({ 'font-size': 42, 'width': 90, 'height': 90, 'margin': '5px auto', 'display': 'block' })
                    .html($('<i>').attr('class', 'fas fa-hand-' + choices[i]))
                    .on('click', function () {
                        ourChoice = $(this).attr('choice-id');
                        ourRef.update({ status: 'ready' });
                        if (matchReady)
                            completeGame();
                    }));
        }

        function runGame() {
            // Found a match, run the game
            matchRef.onDisconnect().update({ opponent: null });
            // Listen for match to disconect or choose.
            matchRef.on('value', function (snapshot) {
                var match = snapshot.val();
                switch (match.status) {
                    case 'disconnected':
                        // Match has left, seek a new one.
                        ourRef.update({ status: 'seeking', opponent: null });
                        awaitMatch();
                        break;
                    case 'ready':
                        // Match has chosen.
                        matchReady = true;
                        if (ourChoice)
                            // We have chosen as well.
                            completeGame();
                        break;
                }
            });
            createChoiceButtons();
            // Change name on database and locally when input changes
            $('#player-name').on('input', function () {
                ourName = $(this).val().trim();
                ourRef.update({ name: ourName });
            });
        }

        function makeMatch() {
            // We have an unmatched player to match with.
            matchRef = database.ref('players/' + matchKey);
            // Set our opponent and status in database.
            ourRef.update({ status: 'matched', opponent: matchKey })
            // Set our opponent's opponent and status in database.
            matchRef.update({ status: 'matched', opponent: ourKey });
            matchRef.once('value').then(function (snapshot) {
                // Access databse once to get match's name
                matchName = snapshot.val().name;
                runGame();
            });
        }

        function awaitMatch() {
            // Listen for match to connect.
            ourRef.on('value', function (snapshot) {
                var us = snapshot.val();
                if (us.status === 'matched') {
                    matchKey = us.opponent;
                    ourRef.off();
                    makeMatch();
                }
            });
            $('#top').text('Waiting for opponent');
        }

        // Set status to disconnected on disconnect.
        ourRef.onDisconnect().update({ status: 'disconnected' })
        if (matchKey)
            // We have a key to match with.
            makeMatch();
        else
            // We wait for someone to match with us.
            awaitMatch();
    });
});