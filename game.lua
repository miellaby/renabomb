game = {}

-- states
state = {
	-- misc state
	idle = {label = 'idle', transition = true},
	activated = {label = 'activated', transition = true},

    -- anime states
	standing = {label = 'standing'},
	walking = {label = 'walking'},
	jumping = {label = 'jumping'},
	suffering = {label = 'suffering'},
	attacking = {label = 'attacking'},
	dying = {label = 'dying'},
	dead = {label = 'dead'},
	
	-- game super states	
	intro = {label = 'intro'},
	tuto = {label = 'tuto'},
	ingame = {label = 'ingame'},
	success = {label = 'success'},
	fail = {label = 'fail'},
	cinematic = {label = 'cinematic'},
	timeout = {label = 'timeout'},
	trophy = {label = 'trophy'},
	
	-- game transitions
	beginning = {label = 'beginning', transition = true},
	continue = {label = 'continue', transition = true},
	retrying = {label = 'retrying', transition = true},
	restarting = {label = 'restarting', transition = true},
	exiting = {label = 'exiting', transition = true},
	reseting = {label = 'reseting', transition = true},
	sharing = {label = 'sharing', transition = true},
	browsing = {label = 'browsing', transition = true},
}

game.state = state.intro
game.guiState = state.idle
game.pause = false
game.running = true -- switch to false when stopping
game.iLevel = 0
function game:setState(state)
	assert(state ~= nil)
	self.state = state
	-- print("setState", state.label)
	waitFor.trigger(waitFor.POKE)
end

function game:waitStateCondition(condition, t)
	-- print("wait condition")
	while game.running and not condition() do
		if waitFor.signal(waitFor.POKE, t) == waitFor.TIMEOUT then
		   return waitFor.TIMEOUT
		end
	end
end

