local tapButton


mask = BitmapBody.new(textureMask)
mask:setAnchorPoint(0.5, 0.45)
mask:setPosition(stageW * 0.5, stageH * 0.45)
mask.floating = true
mask:setColorTransform(0.3, 3, 3, 1)


recycleB = BitmapBody.new(textureRecycle)
recycleB:setAnchorPoint(0.5, 0.5)
recycleB:setPosition(40, 40)
--recycleB:setRotation(45 )
recycleB:setScale(2,2)
recycleB:setAlpha(0.6)
recycleB.acceleration = -0.02
recycleB.floating = true


schoolbag = Body.new()
schoolbagBg = Bitmap.new(textureSchoolbag)
schoolbagBg:setAlpha(0.8) 
schoolbag:addChild(schoolbagBg)
schoolbagBg:setAnchorPoint(0.5,0.45)
schoolbag:setScale(0.4,0.4)
schoolbag:setPosition(stageW - 40, stageH - 60)
schoolbag.floating = true


inventory = BitmapBody.new(textureInventory)
inventory:setScale(0.5,0.5)
inventory:setPosition(stageW - inventory:getWidth(), stageH - inventory:getHeight())

exitB = BitmapBody.new(textureExit)
exitB:setAnchorPoint(0.5, 0.5)
exitB:setAlpha(0.8)
exitB:setPosition(100, 40)
exitB.floating = true

optionsB = BitmapBody.new(TextureRegion.new(textureOptions, soundMode * 64, 0, 64, 64))
--optionsB:setAlpha(0.6)
optionsB:setPosition(stageW - optionsB:getWidth() - 10, 10)
optionsB.floating = true
optionsB:setAnchorPoint(0.5, 0.5)

continueB = BitmapBody.new(textureContinue)
continueB:setAnchorPoint(0.5, 0.5)
continueB:setScale(2, 2)
continueB:setAlpha(0.6)
continueB:setPosition(160, 40)
continueB.floating = true

txtScore = TextField.new(font1, "00000")
txtScore.floating = true
txtScore:setTextColor(0xff6600)
txtScore:setPosition(stageW - 120, 30)

timer = Sprite.new()
timer.txt = TextField.new(font1, "60")
timer.txt:setPosition(-timer.txt:getWidth() / 2, timer.txt:getHeight() / 2)
timer:addChild(timer.txt)
timer.floating = true
timer.txt:setTextColor(0xfbfc5c)
timer:setPosition(stageW / 2, stageH - 29)

txtAmmo = TextField.new(font1, "00 @")
txtAmmo.floating = true
txtAmmo:setTextColor(0xDDDDDD)
txtAmmo:setScale(1/0.4, 1/0.4)
txtAmmo:setPosition(-62, 17)
schoolbag:addChild(txtAmmo)

function setGuiState(s)
	game.guiState = s
	if s == state.tuto then
		timer:removeFromParent()
		txtScore:removeFromParent()
		exitB:stop()
		recycleB:stop()
		schoolbag:stop()
		optionsB:stop()

	elseif s == state.idle then
		recycleB:setAlpha(0.6)
		gui:addChild(txtScore)
		_ = runMode and gui:addChild(timer)
		gui:addMovingChild(recycleB)
		gui:addMovingChild(schoolbag)
		-- _= continueB:getParent() and continueB:setFading(0, 0.8, -0.04, continueB.stop)
		_= exitB:getParent() and exitB:setFading(0, 0.8, -0.04, exitB.stop)
		_= optionsB:getParent() and optionsB:setFading(0, 0.8, -0.04, exitB.stop)
	elseif s == state.activated then
		recycleB:setAlpha(0.8)
		exitB:setFading(0.8, 0.1, 0.02)
		optionsB:setFading(0.9, 0.1, 0.02)

		-- _ = ammo > 0 and continueB:setFading(0.8, 0.1, 0.02) or continueB:stop()
		gui:addMovingChild(exitB)
		gui:addMovingChild(optionsB)
		-- gui:addMovingChild(continueB)
		optionsB:setPosition(160, exitB:getY())

	elseif s == state.success then
		recycleB:setAlpha(0.6)
		gui:addChild(txtScore)
		gui:addMovingChild(recycleB)
		gui:addMovingChild(schoolbag)
		exitB:stop()
		optionsB:stop()
		-- continueB:stop()
		-- gui:addMovingChild(exitB) did by Tap button

	elseif s == state.intro then
		timer:removeFromParent()
		txtScore:removeFromParent()
		exitB:stop()
		recycleB:stop()
		schoolbag:stop()
		optionsB:stop()
		optionsB:setPosition(stageW - optionsB:getWidth() / 2 - 5, stageH - 110 - optionsB:getHeight() / 2)
		-- _= continueB:stop()

	elseif s == state.timeout then
		gui:addMovingChild(exitB)
		exitB:stop()
		recycleB:stop()
		optionsB:stop()
		-- _= continueB:stop()
	end
end

function showMotion0(self)
	if self.motion0 == nil then
		self.motion0 = 0
		self.scale0 = self.scale0 == nil and self:getScaleX() or self.scale0
		self:setScale(0)
		self.zoom = 0
		self.waitForIt = self.showDelay or 1
	elseif self.motion0 == 0 then
		self.waitForIt = self.waitForIt - 1
		if self.waitForIt <= 0 then
			self:setScale(self.scale0 / 10)
			self.zoom = 0.1 -- 0.15
			self.motion0 = 1
		end
	elseif self:getScaleX() >= self.scale0 then
		self:setScale(self.scale0)
		self.zoom = 0
		self.motion0 = nil
		self.animations.show = nil
	else
	    self.zoom = self.zoom * 0.98
	end
end

function clickMotion0(self)
	if self.motion0 == nil then
		self.motion0 = 1
		self.scale0 = self.scale0 == nil and self:getScaleX() or self.scale0
		self:setScale(1.66 * self.scale0)
		self.zoom = - 0.04 * self.scale0 -- -0.024
	elseif self:getScaleX() <= self.scale0 then
		self:setScale(self.scale0)
		self.zoom = 0
		self.motion0 = nil
		self.animations.click = nil
	end
end

function checkButtons(event)
	
	if optionsB:getParent() ~= nil and optionsB:hitTestPoint(event.x, event.y) then
		cycleSoundMode()
		return true
	end
	
	if runModeB:getParent() ~= nil and runModeB:hitTestPoint(event.x, event.y) then
		toggleRunMode()
		return true
	end
	
	if listB:getParent() ~= nil and listB:hitTestPoint(event.x, event.y) then
		tapButton = nil; -- remove any tapButton
		listB.animations.click = clickMotion0
		game:setState(state.browsing)
		return true
	end
	
	if trophyB:getParent() ~= nil and trophyB:hitTestPoint(event.x, event.y) then
		tapButton = nil; -- remove any tapButton
		game:setState(state.trophy)
		trophyB.animations.click = clickMotion0
		return true
	end

	if recycleB:getParent() ~= nil and recycleB:hitTestPoint(event.x, event.y) then
		tapButton = nil; -- remove any tapButton
		recycleB.animations.click = clickMotion0
		
		if game.guiState == state.idle then
			game:setState(state.retrying)
			recycleB.angleSpeed = -10
			_= soundOn and sound('drone1', false):setPitch(3)
			setGuiState(state.activated)
		elseif game.guiState == state.activated then
			setGuiState(state.idle)
		elseif game.guiState == state.success then
			game:setState(state.retrying)
			recycleB.angleSpeed = -10
			_= soundOn and sound('drone1', false):setPitch(3)
			setGuiState(state.idle)
		end
		-- test: 
		-- achievement("You do", "recycleB")
		return true
	end

    if exitB:getParent() ~= nil and exitB:hitTestPoint(event.x, event.y) then
		exitB.animations.click = clickMotion0
		tapButton = nil; -- remove any tapButton
		game:setState(state.restarting)
		return true
	end

    if continueB:getParent() ~= nil and continueB:hitTestPoint(event.x, event.y) then
		continueB.animations.click = clickMotion0
		setGuiState(state.idle)
		return true
	end

	
	if txtRecord ~= nil and txtRecord:getParent() ~= nil and txtRecord:hitTestPoint(event.x, event.y) then
	
		if txtRecord.resetButton:hitTestPoint(event.x, event.y) then
			tapButton = nil; -- remove any tapButton
			game:setState(state.reseting)
		elseif txtRecord.shareButton:hitTestPoint(event.x, event.y) then
			tapButton = nil; -- remove any tapButton
			game:setState(state.sharing)
		else
			if txtRecord:getY() < txtRecord:getHeight() / 2 and txtRecord.iterate == nil then
				txtRecord.ySpeed = 5
				function txtRecord:iterate()
					if self:getY() < self:getHeight() * 0.65 then
						self.ySpeed = self.ySpeed > 1 and self.ySpeed * 0.96 or 1
					else
						self.iterate = nil
						self.ySpeed = 0
					end
				end
			end
		end
		return true
	end
	
	if tapButton ~= nil and tapButton:getParent() ~= nil and tapButton:hitTestPoint(event.x, event.y) then
		tapButton = nil
		waitFor.trigger(waitFor.POKE)
		return true
	end
	
	if game.state == state.intro or game.state == state.cinematic then
		-- print('click cine')
		tapButton = nil; -- remove any tapButton
		game:setState(state.continue)
	end
	
	return false
end

function isTransition()
	return (game.state.transition ~= nil)
end


TapButton = Core.class(Body)
function TapButton:woot()
	self.zoom = (self:getScaleX() < 2) and (0.03 + (2 - self:getScaleX()) / 10) or 0.03 * math.cos((Body.iteration - self.i0) / 10 * math.pi)
end

function TapButton:init(verb, x, y, scale, where)
	function waitTap(t)
		while game.running and tapButton ~= nil do
			if waitFor.signal(waitFor.POKE, t) == waitFor.TIMEOUT then
			   return waitFor.TIMEOUT
			end
		end
	end
	local tapButtonBg = BitmapBody.new(textureButton);
	tapButtonBg:setAnchorPoint(0.5, 0.5)
	tapButtonBg:setAlpha(1)
	tapButtonBg:setScale(scale or 0.6)
	self:addChild(tapButtonBg)
	local tapButtonTxt = TextField.new(font1, "Tap &")
	local tapButtonTxt2 = TextField.new(font1, verb)
	self:addChild(tapButtonTxt)
	self:addChild(tapButtonTxt2)
	tapButtonTxt:setX(-tapButtonTxt:getWidth() / 2)
	tapButtonTxt2:setX(-tapButtonTxt2:getWidth() / 2)
	tapButtonTxt2:setY(tapButtonTxt:getHeight())
	tapButtonTxt2:setTextColor(0xFFFF00)
	tapButtonTxt:setTextColor(0xFFFF00)
	self:setPosition(x == nil and stageW / 2 or x, y == nil and 2 * stageH / 3 or y)
	self.floating = true
	self.fade = 0.1
	self.xSpeed = 0
	self.ySpeed = 0
	self:setAlpha(0.1)
	self:setScale(1, 1)
	self.zoom = 0.01
	self.name = "tapButton"
	self.iterate = self.woot
	where = where or gui
	where:addMovingChild(self)
	
	tapButton = self
	waitTap(2)
	if tapButton ~= nil and game.guiState == state.success then
		gui:addMovingChild(exitB)
		exitB:setFading(0.8, 0, 0.04)
	end
	waitTap()
	self.iterate = nil
	self.angleSpeed = 0
	self.ySpeed = 4
	self.zoom = 0.1
	self.fade = -0.05
	self:setTtl(20)
	resetSounds()
end

Caption = Core.class(Body)
function Caption:woot()
	self.zoom = (self:getScaleX() < 1) and (0.01 + (1 - self:getScaleX()) / 10) or 0.01 * math.cos((Body.iteration - self.i0) / 10 * math.pi)
	if (Body.iteration > self.i0 + 150) then	
		self.iterate = nil
		self.angleSpeed = 0
		self.ySpeed = -2
		self.zoom =  0.04 -- -0.01
		self.fade = -0.05
		self:setTtl(50)
	end
end

function Caption:init(x, y, xc, yc, txt1, txt2)
	local eventType, event
	local captionBg = Bitmap.new(captionMainRegion)
	captionBg:setAnchorPoint(0.5, 0.5)
	captionBg:setScale(1, 1)
	local captionTail = Bitmap.new(captionTailRegion)
	captionTail:setAnchorPoint(0.5, 0.5)
	captionTail:setPosition((x - xc) * 0.5, (y - yc) * 0.5)
	local a = (x > xc) and math.atan((y - yc) / (x - xc)) or (x < xc) and math.pi - math.atan((y - yc) / (xc - x)) or ((y > yc)  and (math.pi / 2) or 3 * (math.pi / 2))
	captionTail:setRotation(a * 180 / math.pi)
	self:addChild(captionTail)
	self:addChild(captionBg)
	local captionTxt = TextField.new(font1, txt1)
	local captionTxt2 = TextField.new(font1, txt2)
	self:addChild(captionTxt)
	self:addChild(captionTxt2)
	captionTxt:setX(-captionTxt:getWidth() / 2)
	captionTxt2:setX(-captionTxt2:getWidth() / 2)
	captionTxt2:setY(captionTxt:getHeight())
	captionTxt2:setTextColor(0x6666FF)
	captionTxt:setTextColor(0x6666FF)
	self:setPosition(xc, yc)
	self.floating = true
	self.fade = 0.1
	self.xSpeed = 0
	self.ySpeed = 0
	self:setAlpha(0.1)
	self:setScale(0.3, 0.3)
	self.zoom = 0.04 -- 0.01
	self.i0 = Body.iteration
	self.name = "caption" .. txt1
	self.iterate = self.woot
	level:addMovingChild(self)
end


function achievement(msg1, msg2)
	local txtAchievement = Body.new()

	local txtAchievementTxt = TextField.new(font1, msg1)
	txtAchievementTxt:setX(-txtAchievementTxt:getWidth() / 2)
	txtAchievementTxt:setY(-txtAchievementTxt:getHeight() * 0.7)
	txtAchievementTxt:setTextColor(0xDD0000)
	
	local txtAchievementBg = Bitmap.new(captionMainRegion)

	txtAchievementBg:setAnchorPoint(0.5, 0.5)
	txtAchievementBg:setAlpha(1)
	-- txtAchievementBg:setColorTransform(0.1, 10, 10, 1)
	
	local txtAchievementTxt2 = TextField.new(font1, msg2)
	txtAchievementTxt2:setX(-txtAchievementTxt2:getWidth() / 2)
	txtAchievementTxt2:setY(txtAchievementTxt:getHeight())
	txtAchievementTxt2:setTextColor(0xFF0000)
	
	txtAchievement:addChild(txtAchievementBg)
	txtAchievement:addChild(txtAchievementTxt)
	txtAchievement:addChild(txtAchievementTxt2)
	
	txtAchievement:setPosition(stageW * 0.5, 0.7 * stageH)
	txtAchievement.floating = true
	txtAchievement.xSpeed = 0
	txtAchievement.ySpeed = 0
	txtAchievement:setScale(0.1)
	txtAchievement.name = "txtAchievement"
	function txtAchievement:iterate()
		if soundOn and (Body.iteration - self.i0) < 100 and (Body.iteration - self.i0) % 10 == 0 then
			 sound('success-high'):setPitch(math.pow(1.059, (31 * ((Body.iteration - self.i0) / 10) % 5) % 16))
		end
		
		self:setRotation(10 * math.sin(Body.iteration - self.i0) * math.sin((Body.iteration - self.i0) * 0.04))	

		if (self:getScaleY() < 2) then
			self.zoom = (2 - self:getScaleY()) * self:getScaleY() / 10
			self.zoom = self.zoom < 0.1 and 0.1 or self.zoom -- 0.01 
		else
			if self.ttl == nil then
				self.zoom = 0
				self:setTtl(500)
			else
				if (Body.iteration - self.i0) % 40 == 0 and math.random(4) > 1 then
					local x, y = math.random(stageW * 0.2) + stageW * 0.4, math.random(stageH * 0.2) + stageH * 0.2
					bling(x, y, (x - stageW * 0.5) / 30, (y - stageH * 0.25) / 10, 4, true)
				end
			end
		end
	end
	-- stage:addMovingChild(txtAchievement)
	stage:addChild(txtAchievement)
	txtAchievement:resume()
	--bling(math.random(stageW / 2) + stageW / 4, 0, 0, 4, 20)
	--bling(math.random(stageW / 2) + stageW / 4, 0, 0, 4, 20)
end

function maskStage(thenCb)
	local star = BitmapBody.new(textureStar)
	star:setColorTransform(0.3, 3, 3, 1)
	star:setAlpha(1)
	star:setAnchorPoint(0.5, 0.5)
	star:setPosition(stageW / 2, stageH * 0.40)
	star:setScale(1)
	star.zoom = 0.2
	star:setTtl(14)
	function star:iterate()
		self.zoom = self.zoom * 1.1
	end
	function star:final()
		self:stop()
		-- mask:setColorTransform(0, 0, 0, 1)
		mask:setScale(1)
		mask:setAlpha(1)
		stage:addChild(mask)
		mask:freeze()
		_= thenCb and thenCb()
		
	end
	stage:addMovingChild(star)
	return star
end

function unmaskStage(thenCb)
	-- mask:setColorTransform(0, 0, 0, 1)
	mask:setScale(1)
	mask:setAlpha(1)
	mask.zoom = 0.2
	mask:setTtl(25)
	function mask:iterate()
		self.zoom = mask.zoom * 1.1
	end
	function mask:final()
		self:stop()
		_= thenCb and thenCb()
	end
	stage:addMovingChild(mask)
	return mask
end

