import React from 'react';
import PropTypes from 'prop-types';
import { findDOMNode } from 'react-dom';
import { connect } from 'react-redux';
import $ from 'jquery';
import _ from 'underscore';

import AlertPanel from './SiteComponents/AlertPanel';
import Panel from './SiteComponents/Panel';
import DeckRow from './DeckRow';
import Messages from './GameComponents/Messages';
import Avatar from './Avatar';

import * as actions from './actions';

class InnerPendingGame extends React.Component {
    constructor() {
        super();

        this.isGameReady = this.isGameReady.bind(this);
        this.onSelectDeckClick = this.onSelectDeckClick.bind(this);
        this.onLeaveClick = this.onLeaveClick.bind(this);
        this.onStartClick = this.onStartClick.bind(this);
        this.onChange = this.onChange.bind(this);
        this.onKeyPress = this.onKeyPress.bind(this);
        this.onSendClick = this.onSendClick.bind(this);
        this.onMouseOut = this.onMouseOver.bind(this);

        this.state = {
            playerCount: 1,
            decks: [],
            playSound: true,
            message: '',
            decksLoading: true,
            waiting: false
        };
    }

    componentDidMount() {
        this.props.loadDecks();
    }

    componentWillReceiveProps(props) {
        let players = _.size(props.currentGame.players);

        if(this.state.playerCount === 1 && players === 2 && props.currentGame.owner === this.props.username) {
            this.refs.notification.play();
        }

        if(props.connecting) {
            this.setState({ waiting: false });
        }

        this.setState({ playerCount: players });
    }

    componentDidUpdate() {
        $(this.refs.messagePanel).scrollTop(999999);
    }

    isGameReady() {
        if(!_.all(this.props.currentGame.players, player => {
            return !!player.deck.selected;
        })) {
            return false;
        }

        return this.props.currentGame.owner === this.props.username;
    }

    onSelectDeckClick() {
        $(findDOMNode(this.refs.modal)).modal('show');
    }

    selectDeck(index) {
        $(findDOMNode(this.refs.modal)).modal('hide');

        this.props.socket.emit('selectdeck', this.props.currentGame.id, this.props.decks[index]);
    }

    getPlayerStatus(player, username) {
        let playerIsMe = player && player.name === username;

        let deck = null;
        let selectLink = null;
        let status = null;

        if(player && player.deck && player.deck.selected) {
            if(playerIsMe) {
                deck = <span className='deck-selection clickable' data-toggle='modal' data-target='#decks-modal'>{ player.deck.name }</span>;
            } else {
                deck = <span className='deck-selection'>Deck Selected</span>;
            }

            let statusClass = 'deck-status';
            if(player.deck.status === 'Valid') {
                statusClass += ' valid';
            } else if(player.deck.status === 'Invalid') {
                statusClass += ' invalid';
            } else if(player.deck.status === 'Unreleased Cards') {
                statusClass += ' unreleased';
            }

            status = <span className={ statusClass }>{ player.deck.status }</span>;
        } else if(player && playerIsMe) {
            selectLink = <span className='card-link' data-toggle='modal' data-target='#decks-modal'>Select deck...</span>;
        }

        return (
            <div className='player-row' key={ player.name }>
                <Avatar emailHash={ player.emailHash } forceDefault={ player.settings ? player.settings.disableGravatar : false } /><span>{ player.name }</span>{ deck } { status } { selectLink }
            </div>);
    }

    getGameStatus() {
        if(this.props.connecting) {
            return 'Connecting to game server: ' + this.props.host;
        }

        if(this.state.waiting) {
            return 'Waiting for lobby server...';
        }

        if(_.size(this.props.currentGame.players) < 2) {
            return 'Waiting for players...';
        }

        if(!_.all(this.props.currentGame.players, player => {
            return !!player.deck.selected;
        })) {
            return 'Waiting for players to select decks';
        }

        return 'Ready to begin, click start to begin the game';
    }

    onLeaveClick(event) {
        event.preventDefault();

        this.props.socket.emit('leavegame', this.props.currentGame.id);

        this.props.gameSocketClose();
    }

    onStartClick(event) {
        event.preventDefault();

        this.setState({ waiting: true });

        this.props.socket.emit('startgame', this.props.currentGame.id);
    }

    sendMessage() {
        if(this.state.message === '') {
            return;
        }

        this.props.sendSocketMessage('chat', this.state.message);

        this.setState({ message: '' });
    }

    onKeyPress(event) {
        if(event.key === 'Enter') {
            this.sendMessage();

            event.preventDefault();
        }
    }

    onSendClick(event) {
        event.preventDefault();

        this.sendMessage();
    }

    onChange(event) {
        this.setState({ message: event.target.value });
    }

    onMouseOver(card) {
        this.props.zoomCard(card);
    }

    render() {
        if(this.props.currentGame && this.props.currentGame.started) {
            return <div>Loading game in progress, please wait...</div>;
        }

        let index = 0;
        let decks = null;

        if(this.props.loading) {
            decks = <div>Loading decks from the server...</div>;
        } else if(this.props.apiError) {
            decks = <AlertPanel type='error' message={ this.props.apiError } />;
        } else {
            decks = _.size(this.props.decks) > 0 ? _.map(this.props.decks, deck => {
                let row = <DeckRow key={ deck.name + index.toString() } deck={ deck } onClick={ this.selectDeck.bind(this, index) } active={ index === this.state.selectedDeck } />;

                index++;

                return row;
            }) : <div>You have no decks, please add one</div>;
        }

        let popup = (
            <div id='decks-modal' ref='modal' className='modal fade' tabIndex='-1' role='dialog'>
                <div className='modal-dialog' role='document'>
                    <div className='modal-content deck-popup'>
                        <div className='modal-header'>
                            <button type='button' className='close' data-dismiss='modal' aria-label='Close'><span aria-hidden='true'>×</span></button>
                            <h4 className='modal-title'>Select Deck</h4>
                        </div>
                        <div className='modal-body'>
                            <div className='deck-list-popup'>
                                { decks }
                            </div>
                        </div>
                    </div>
                </div>
            </div>);

        return (
            <div>
                <audio ref='notification'>
                    <source src='/sound/charge.mp3' type='audio/mpeg' />
                    <source src='/sound/charge.ogg' type='audio/ogg' />
                </audio>
                <Panel title={ this.props.currentGame.name }>
                    <div className='btn-group'>
                        <button className='btn btn-primary' disabled={ !this.isGameReady() || this.props.connecting || this.state.waiting } onClick={ this.onStartClick }>Start</button>
                        <button className='btn btn-primary' onClick={ this.onLeaveClick }>Leave</button>
                    </div>
                    <div className='game-status'>{ this.getGameStatus() }</div>
                </Panel>
                <Panel title='Players'>
                    {
                        _.map(this.props.currentGame.players, player => {
                            return this.getPlayerStatus(player, this.props.username);
                        })
                    }
                </Panel>
                <Panel title={ `Spectators(${ this.props.currentGame.spectators.length })` }>
                    { _.map(this.props.currentGame.spectators, spectator => {
                        return <div key={ spectator.name }>{ spectator.name }</div>;
                    }) }
                </Panel>
                <Panel title='Chat'>
                    <div className='message-list'>
                        <Messages messages={ this.props.currentGame.messages } onCardMouseOver={ this.onMouseOver } onCardMouseOut={ this.onMouseOut } />
                    </div>
                    <form className='form form-hozitontal'>
                        <div className='form-group'>
                            <input className='form-control' type='text' placeholder='Enter a message...' value={ this.state.message }
                                onKeyPress={ this.onKeyPress } onChange={ this.onChange } />
                        </div>
                    </form>
                </Panel>
                { popup }
            </div >);
    }
}

InnerPendingGame.displayName = 'PendingGame';
InnerPendingGame.propTypes = {
    apiError: PropTypes.string,
    connecting: PropTypes.bool,
    currentGame: PropTypes.object,
    decks: PropTypes.array,
    gameSocketClose: PropTypes.func,
    host: PropTypes.string,
    loadDecks: PropTypes.func,
    loading: PropTypes.bool,
    sendSocketMessage: PropTypes.func,
    socket: PropTypes.object,
    username: PropTypes.string,
    zoomCard: PropTypes.func
};

function mapStateToProps(state) {
    return {
        apiError: state.api.message,
        connecting: state.socket.gameConnecting,
        currentGame: state.games.currentGame,
        decks: state.cards.decks,

        host: state.socket.gameHost,
        loading: state.api.loading,
        socket: state.socket.socket,
        username: state.auth.username
    };
}

const PendingGame = connect(mapStateToProps, actions)(InnerPendingGame);

export default PendingGame;

