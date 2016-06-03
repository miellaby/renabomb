-- signals for player actions
local no_action, firing = {}, {}

-- curent player action
local action_state = no_action

-- coroutine main function
function action()
	pendingFires = {}

	-- floating bomb next to the player
	local bomb = BitmapBody.new(bombRegion1)
	bomb.floating = true
	bomb.gleam = Bitmap.new(bombRegionLight)
	bomb:addChild(bomb.gleam)
	bomb.gleam:setAnchorPoint(0.5, 0.5)
	bomb.angleSpeed = 0.01
	bomb:setAnchorPoint(0.5,0.5)
	bomb:setScale(0.25, 0.25)
	
	-- animation to spawn a new bomb
	function bomb:puff()
		local s = self:getScaleX()
		if s > 0.25 then
			self.zoom = 0.02 / (0.23 - s)
			self:setAlpha(1.5 - 2 * s)
		else
			self:setScale(0.25, 0.25)
			self.zoom = 0
			self:setAlpha(1)
			self.iterate = nil
		end
	end

	rena.bomb = bomb

	function rena:throwingIterator()
		if self.loop > 0 or self.regions ~= throwingRegions then
			if self.regions == throwingRegions then
				-- standing
				rena:setTextureLoop(standingRegions, 5)
			end
			self.iterate = nil
			rena:setAnchorPoint(0.5, 0.66)
		end
	end
				
	local event
	function isFiringOrExiting()
		return exiting or game.state == state.ingame and (action_state == firing or table.getn(pendingFires) > 0)
	end
	
	while game.running do
		action_state = no_action
		waitFor.condition(isFiringOrExiting)
		
		if game.state == state.ingame then
			local x = rena:getX() + rena:getWidth() * (rena.flip and 0.1 or -0.1)
			local y = rena:getY() - renaHeight * 0.8
			
			arrow.a = 0
			arrow.d = 0
			local a = (arrow.xm > x) and math.atan((arrow.ym - y) / (arrow.xm - x)) or (arrow.xm < x) and math.pi - math.atan((arrow.ym - y) / (x - arrow.xm)) or ((arrow.ym > y)  and (math.pi / 2) or 3 * (math.pi / 2))
			arrow.a = (a > math.pi / 2) and a - math.pi / 20 or a + math.pi / 20
			local d = math.sqrt((arrow.xm -x) * (arrow.xm -x) + (arrow.ym - y) * (arrow.ym - y)) 
			arrow.d = d * 0.7
			stage:addChild(from)
			stage:addChild(bar)
			stage:addChild(arrow)
			if soundOn then
				sound('stretching'):setLooping(true)
			end
	
			if ammo > 0 then
				_ = game.guiState == state.activated and setGuiState(state.idle)

				-- bomb puffing
				rena:addMovingChild(rena.bomb)
				rena.bomb:setScale(0.75, 0.75)
				rena.bomb.iterate = rena.bomb.puff
				rena.bomb:setPosition(rena:getWidth() * -0.07, -renaHeight * 0.3)
			end
	
			-- crouching
			rena:setTextureLoop(crouchingRegions, 8)
			rena:setAnchorPoint(0.5, 0.66)
			waitFor.condition(function() return game.state ~= state.ingame or rena.loop > 0 or table.getn(pendingFires) > 0 end)
		
			if (game.state == state.ingame and table.getn(pendingFires) == 0) then
				-- targeting
				rena:setTextureLoop(targetingRegions, 20)
				rena:setAnchorPoint(0.5, 0.66)
				
				waitFor.condition(function() return game.state ~= state.ingame or table.getn(pendingFires) > 0 end)
			end
			
			_= rena.bomb:getParent() ~= nil and rena:removeMovingChild(rena.bomb)
		
			if game.state == state.ingame and table.getn(pendingFires) > 0 then

				local fire = table.remove(pendingFires)
				if ammo > 0 then
					local xm, ym = fire.x, fire.y
					local x = rena:getX() + (rena.flip and 6 or -25)
					local y = rena:getY() - renaHeight * 0.85
					local bomb = Bomb.new(bombRegions[1], level)
					bomb:setPosition(x, y)
					
					local speed = 0.01 + 0.05 * math.sqrt((x - xm) * (x - xm) + (y - ym) * (y - ym))
					local angle = (xm > x) and math.atan((ym - y) / (xm - x)) or (xm < x) and math.pi - math.atan((ym - y) / (x - xm)) or ((ym > y)  and (math.pi / 2) or 3 * (math.pi / 2))
					speed = speed < 0.01 and 0.01 or speed
					-- debug:
					-- bill(x, y, string.format("%.1f", speed), 0x000000)
					bomb:setSpeed(speed * math.cos(angle), speed * math.sin(angle))
					bling(x, y, -speed * math.cos(angle), -speed * math.sin(angle), 2)
					
					ammo = ammo - 1
					txtAmmo:setText(string.format("%02d @", ammo))
					if ammo == 0 and withAd then
						_= willShowAdTimer and willShowAdTimer:stop()
						willShowAdTimer = Timer.delayedCall(4000, function()
							adIsVisible = true
							admob.setVisible(true)
						end)
					end

					
					if soundOn then
						sound('slap'):setVolume(0.5)
						local s = sound('timer0', true)
						if s == noSound or s:isPaused() or not s:isPlaying()then
							timerPitch = 1
							sound('timer0', false, true)
						end
					end
				else
					-- click
					_= soundOn and sound('slap'):setPitch(4)
				end
			end
		
			if (arrow.a) then
				arrow.a	= nil
				stage:removeChild(arrow)
				stage:removeChild(bar)
				stage:removeChild(from)
				_ = soundOn and sound('stretching', true):setPaused(true)
			end
			
			if (game.state == state.ingame and table.getn(pendingFires) == 0) then
				-- firing
				rena:setTextureLoop(throwingRegions, 3) 
				rena:setAnchorPoint(0.5, 0.8)
				rena.iterate = rena.throwingIterator
			end
			
			if (game.state ~= state.ingame) then
					-- standing
				rena:setTextureLoop(standingRegions, 5)
				rena:setAnchorPoint(0.5, 0.66)
			end
		end
	end

end
local coaction = coroutine.create(action)
names[coaction] = 'action'
ok, msg = coroutine.resume(coaction)
if (not ok) then error(msg) end


retarget = function(event)
	arrow.xm, arrow.ym = event.x, event.y
end

stage:addEventListener(Event.MOUSE_DOWN, function(event)
	if not checkButtons(event) and game.state == state.ingame and action_state == no_action then
		arrow.xm, arrow.ym = event.x, event.y
		action_state = firing
	end
	waitFor.triggerEvent(event);
end)

stage:addEventListener(Event.MOUSE_UP, function(event)
	if game.state == state.ingame and action_state == firing then
		-- firing
		table.insert(pendingFires, {x = event.x, y = event.y})
	end
end)
	
stage:addEventListener(Event.MOUSE_MOVE, retarget)

starLevel = 0
stage:addEventListener(Event.KEY_DOWN, function(event)
	if (game.state == state.intro or state.state == state.cinematic) then
		if event.keyCode == KeyCode.BACK or event.keyCode == KeyCode.ESC then
			application:exit()
		elseif event.keyCode >= KeyCode.NUM_0 and event.keyCode <= KeyCode.NUM_9 then
			firstLevel = firstLevel * 10 + (event.keyCode - KeyCode.NUM_0)
		end
	elseif event.keyCode == KeyCode.BACK or event.keyCode == KeyCode.ESC then
		game:setState(state.restarting);
	end
end)