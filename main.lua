-- main file
withAd = false
adIsVisible = false
willShowAdTimer = nil
willHideAdTimer = nil
if application:getDeviceInfo() == "Android" then
	-- require 'admob'
	-- withAd = true
	-- admob.setAlignment('center', 'bottom')
	-- admob.setVisible(false)
end


application:setBackgroundColor(0xFFFFFF)
firstLevel = 0
demoLevel = 5

stage.gravity = 0
stage.boing = 0

rena.xSpeed = 0
rena.ySpeed = 0
rena.flip = false
rena:setTextureLoop(standingRegions, 5)
rena:setAnchorPoint(0.5, 0.66)


math.randomseed(os.time())




local lastOptionsBCaption = nil
function cycleSoundMode()
		soundMode = (soundMode + 1) % 3
		musicOn = (soundMode == 0)
		soundOn = (soundMode <= 1)
		optionsB.animations.click = clickMotion0
		if musicOn then
			local m = sound('music')
			m:setLooping(true)
			m:setVolume(1)
		else
			sound('music', true):stop()
		end
		if soundOn then
			sound('boing', false):setPitch(1)
		else
			resetSounds()
		end
	_ = lastOptionsBCaption and lastOptionsBCaption:stop()
	lastOptionsBCaption = Caption.new(optionsB:getX(), optionsB:getY(), stageW * 0.75, stageH / 2, musicOn and "music ON" or "music off", soundOn and "sound ON" or "sound off")
	optionsB:setTextureRegion(TextureRegion.new(textureOptions, soundMode * 64, 0, 64, 64))
end

local lastRunModeCaption = nil
function toggleRunMode()
	-- print("runMode", runMode)
	runModeB.motion0 = nil
	runModeB.animations.click = clickMotion0
	_ = lastRunModeCaption and lastRunModeCaption:stop()
	if maxLevel < 20 then
		lastRunModeCaption = Caption.new(runModeB:getX(), runModeB:getY() - 50, runModeB:getX(), runModeB:getY() - 160, "win", "level 20")
	else
		setRunMode(not runMode)
		_ = soundOn and sound('boing', false):setPitch(1)
		if txtRecord ~= nil then
			txtRecord.txt:setText(not runMode and record or runModeRecord)
			txtRecord.txt:setX(-txtRecord.txt:getWidth() / 2)
			txtRecord.motion0 = nil
			txtRecord.animations.show = showMotion0
		end
		if runMode then
			listB:stop()
		elseif runModeB:getParent() ~= nil then
			listB:setScale(1)
			stage:addMovingChild(listB)
		end
		lastRunModeCaption = Caption.new(runModeB:getX(), runModeB:getY() - 50, runModeB:getX() + 12, runModeB:getY() - 160, "Speed run", runMode and "is ON!!" or "is off")	
	end
end

function setRunMode(onOff)	
	if maxLevel < 20 then
		runMode = false
		runModeB:setColorTransform(0.4, 0.3, 0.3, 1)
	else
		runMode = onOff
		runModeB:setAlpha(1)
		runModeB:setColorTransform(runMode and 1 or 0.65, runMode and 1 or 0.5, 1, 1)

		runModeStateTxt:setText(runMode and "ON ! ! !" or " off")
		runModeStateTxt:setTextColor(runMode and 0xff0000 or 0x332222)
		runModeStateTxt:setPosition(runModeStateTxt:getWidth() * -0.5, 3 * runModeStateTxt:getHeight())
	end
	
	if withAd then
		if not runMode then
			admob.loadAd('ca-app-pub-7944421229795410/4211523484', 'smart_banner')
		else
			admob.removeAd()
		end
	end
end
setRunMode(runMode)


function gameIteration(delta)
	local t0 = os.timer()
	waitFor.tick(delta)
	Body.animate()

	-- print('duration', 'animation', os.timer() - t0)
	stage.boing = stage.boing * 0.9

	if level and level.animations.toastIn == nil and stage.boing ~= 0 then
		local i = Body.iteration
		local b = -math.cos(math.pi * (i % 360) * (1 + stage.boing) / 180) * stage.boing
		level.background:setY(stageH / 2 + b / 4)
		level:setY(b / 4)
		-- background:setBlendMode(Sprite.ADD)
		-- background:setBlendMode(Sprite.ALPHA)
		local whiteness = 10 / (10 + stage.boing)
		level.background:setAlpha(whiteness)
		frame:setColorTransform(whiteness, whiteness, whiteness, 1)
		frame:setPosition(-40 + b / 4, - 60 + b / 4)
		if stage.boing < 0.01 then
			level.background:setAlpha(1)
			-- background:clearBlendMode(	)
			stage.boing = 0
			application:setBackgroundColor(0xFFFFFF)
		elseif b < -20 and math.random(2) == 1 then
			dust();
		end
	end

	if (arrow.a ~= nil) then
		local x = rena:getX() + rena:getWidth() * (rena.flip and 0.1 or -0.1)
		local y = rena:getY() - renaHeight * 0.8
		local xm, ym = arrow.xm, arrow.ym
		local a = (xm > x) and math.atan((ym - y) / (xm - x)) or (xm < x) and math.pi - math.atan((ym - y) / (x - xm)) or ((ym > y)  and (math.pi / 2) or 3 * (math.pi / 2))
		local d = math.sqrt((xm -x) * (xm -x) + (ym - y) * (ym - y)) 
		d = arrow.d + (d - arrow.d) / 10
		a = arrow.a == 0 and a or (arrow.a + (a - arrow.a) / 10)
		arrow.d = d
		arrow.a = a
	end
	

	if runMode and game.state == state.ingame then
		remainingTime = remainingTime - 1
		local r = remainingTime % 60
		local t = math.floor(remainingTime  / 60)
		timer:setScale((t <= 10 and 2 or 1) + r * r / 1500 )
		if remainingTime % 60 == 0 then
			if t == 10 then
				timer.txt:setTextColor(0xff0000)
				_ = musicOn and sound('music', true):setVolume(0)
			elseif t <= 10 then
				_ = soundOn and sound("boing")
			end
			timer.txt:setText(string.format("%02d", t))
			if remainingTime == 0 then
				game:setState(state.timeout)
			end
		end
	end
	
	if (scoreCounter ~= score) then
		local inc = math.ceil((score - scoreCounter)/ 11)
		if inc < 1 then inc = 1 end
		scoreCounter = scoreCounter + inc
		if (scoreCounter >= score) then
			scoreCounter = score
			txtScore:setTextColor(0xff6600)
		else
			txtScore:setTextColor(0xFFFF00)
		end
		txtScore:setText(string.format("%05d", scoreCounter))
	end

	if (arrow.a ~= nil) then
		local x = rena:getX() + rena:getWidth() * (rena.flip and 0.1 or -0.1)
		local y = rena:getY() - renaHeight * 0.8
		local xm, ym = arrow.xm, arrow.ym
		local a = arrow.a
		local d = arrow.d
		from:setRotation(a / math.pi * 180)
		from:setPosition(x, y)
		bar:setScaleX(d < 40 and 0 or (d - 40) / textureBar:getWidth())
		bar:setPosition(x + d * math.cos(a) / 2, y + d * math.sin(a) / 2)
		bar:setRotation(a / math.pi * 180)
		arrow:setPosition(x + d * math.cos(a), y + d * math.sin(a))
		arrow:setRotation(a / math.pi * 180)
		if (recycleB:hitTestPoint(xm, ym)) then
			if recycleB:getY() == 40 then
				recycleB:setY(stageH - 60)
			else
				recycleB:setY(40)
			end
		end
		
		if (rena.flip and xm > x or not rena.flip and xm < x) then
			rena.flip = not rena.flip
			rena:setScale(rena.flip and -2 or 2, 2)
		end
	end
end


local timeAccumulator = 0
function onEnterFrame(event)
	-- print('begin onEnterFrame', game.state.label)
	local delta = event.deltaTime
	-- print(delta)

	timeAccumulator = timeAccumulator + delta  -- - timeRate
	if timeAccumulator > timeRate * 4 then
		timeAccumulator = timeRate * 4
		lowend = lowend >= 40 and lowend or (lowend + 5)
	else
		lowend = lowend > 1 and lowend * 0.8 or 0
	end

	-- print('lowend', lowend)
	-- lowend = 2
	
	while game.running and timeAccumulator > 0 do
		gameIteration(timeRate)
		timeAccumulator = timeAccumulator - timeRate
	end

	
    -- print('end onEnterFrame')
end


function intro()
	firstLevel = 0 -- can be edited by keypress

	if level ~= nil then
		level:resume()
		level:setFading(0, 1, -0.04, level.finalize)
		waitFor.seconds(0.5)
	end
	
	game.iLevel = 0
	local demo = Level.new(demoLevel)
	demo.floating = true
	demo:focus()
	demo:setFading(1, 0, 0.04, demo.freeze)
	demo:resume()
	-- print('r')
	local textureTitle = Texture.new("title.png", false, {format = TextureBase.RGBA5551})
	local title = BitmapBody.new(textureTitle)
	local titleBis = BitmapBody.new(textureTitle)
	_ = musicOn and sound('music', true):setVolume(0)
	_ = soundOn and sound('drone1'):setLooping(true)
	
	if record > 0 then
		txtRecord = Body.new()
		
		local txtRecordTxt = TextField.new(font1, "Record")
		txtRecordTxt:setX(-txtRecordTxt:getWidth() / 2)
		txtRecordTxt:setY(-txtRecordTxt:getHeight() * 0.35)
		txtRecordTxt:setTextColor(0x5533AA)
		
		local txtRecordBg = Bitmap.new(textureMacaron)

		txtRecordBg:setAnchorPoint(0.5, 0.8)
		--txtRecordBg:setBlendMode(Sprite.SCREEN)
		--txtRecordBg:setAlpha(0.6)
		--txtRecordBg:setColorTransform(0.8, 0.8, 10, 0.8)
		txtRecordBg:setScale(1, 1)
		
		txtRecord.txt = TextField.new(font1, not runMode and record or runModeRecord)
		txtRecord.txt:setX(-txtRecord.txt:getWidth() / 2)
		txtRecord.txt:setY(txtRecordTxt:getHeight())
		txtRecord.txt:setTextColor(0xff3311)
		txtRecord.resetButton = TextField.new(font1, '(X)');
		txtRecord.resetButton:setX(-txtRecordTxt:getWidth() / 2 - txtRecord.resetButton:getWidth() * 0.1);
		txtRecord.resetButton:setY(-2.6 * txtRecordTxt:getHeight());
		txtRecord.shareButton =  Bitmap.new(Texture.new("reddit_head.png", false, {format = TextureBase.RGBA5551}));
		txtRecord.shareButton:setX(txtRecordTxt:getWidth() / 2 - txtRecord.shareButton:getWidth() * 0.9);
		txtRecord.shareButton:setY(-3.6 * txtRecordTxt:getHeight() - txtRecord.shareButton:getHeight() / 2);
		
		txtRecord:addChild(txtRecordBg)
		txtRecord:addChild(txtRecordTxt)
		txtRecord:addChild(txtRecord.txt)
		txtRecord:addChild(txtRecord.resetButton)
		txtRecord:addChild(txtRecord.shareButton)
		stage:addChildAt(txtRecord, stage:getChildIndex(stage.particles))		
		txtRecord:resume()
		
		txtRecord:setPosition(stageW / 3, 34)
		txtRecord.floating = true
		txtRecord:setScale(0)
		txtRecord.scale0 = 1.5
		txtRecord.name = "txtRecord"
		txtRecord.motion0 = nil
		txtRecord.animations.show = showMotion0

		if not runMode then
			stage:addMovingChild(listB)
			listB.showDelay = 10
			listB:setScale(0)
			listB.scale0 = 1
			listB.motion0 = nil
			listB.animations.show = showMotion0
		end
		
		stage:addMovingChild(trophyB)
		trophyB.showDelay = 10
		trophyB:setScale(0)
		trophyB.scale0 = 0.2
		trophyB.motion0 = nil
		trophyB.animations.show = showMotion0

		stage:addMovingChild(optionsB)		
		optionsB:setTextureRegion(TextureRegion.new(textureOptions, soundMode * 64, 0, 64, 64))
		optionsB:setAlpha(1)
		optionsB.showDelay = 20
		optionsB:setScale(0)
		optionsB.scale0 = 1
		optionsB.motion0 = nil
		optionsB.animations.show = showMotion0

		stage:addMovingChild(runModeB)
			
		if maxLevel >= 20 then
			runModeB.showDelay = 30
			runModeB:setScale(0)
			runModeB.scale0 = 1
			runModeB.motion0 = nil
			runModeB.animations.show = showMotion0
		end
	end
	
	title:setScale(4, 4)
	titleBis:setScale(4, 4)
	--title.acceleration = 0.001
	title.floating = true
	titleBis.floating = true
	rena.angleSpeed = 0
	title.xSpeed, title.ySpeed = 0, 0
	titleBis.xSpeed, title.ySpeed = 0, 0
	level:addMovingChild(title)
	level:addMovingChild(titleBis)
	title:setPosition(stageW, stageH -title:getHeight() / 2.2)
	titleBis:setPosition(-title:getWidth(), -title:getHeight() / 2)

	title.xSpeed = -10
	titleBis.xSpeed = 10
	title.name = "title"
	function title:iterate()
		if (self.xSpeed ~= 0) then
			if self:getX() < -self:getWidth() then
				self:setAnchorPoint(0.5, 0.5)
				self:setPosition(stageW / 2, stageH / 2.5)
				self.xSpeed = 0
				self.angleSpeed = 10
				self.zoom = -0.014 * self:getScale()
				titleBis:stop()
			end
		elseif (self:getScaleX() < 1) then
			self.zoom = 0
			self.angleSpeed = 0
			self:setRotation(0)
			self.iterate = nil
		end
	end
	local credits
	local thing = Sprite.new() -- used with explode

	function pauseIntro(s)
		local w, event = waitFor.signal(Event.MOUSE_DOWN, s)
		return game.state ~= state.intro
	end
	
	while true do
	
		if pauseIntro(5) then break end
		thing:setPosition(2 * stageW / 3, stageH / 2)
		explode(thing, 4)
		bling(thing:getX(), thing:getY(), 0, 1, 2)
		if pauseIntro(0.3) then break end
		if soundOn then sound('drone1', true):setPaused(true) end
		
		thing:setX(stageW / 4)
		thing:setY(stageH / 4)
		explode(thing, 3)
		bling(thing:getX(), thing:getY(), 0, 1, 3)
		if pauseIntro(0.1) then break end
		explode(thing, 4)
		if pauseIntro(0.3) then break end

		thing:setPosition(stageW / 3, stageH / 3)
		explode(thing, 4)

		bling(thing:getX(), thing:getY(), 0, -1, 2)
		if pauseIntro(0.3) then break end
		
		thing:setPosition(2 * stageW / 3, 2 * stageH / 3)
		explode(thing, 4)

		credits = Body.new()
		credits.name = "credits"
		local creditTexts = {
			"Zoids Music by Juha Kaunisto (sumppi); 1985 original by Rob Hubbard  http://www.remix64.com/member/sumppi/",
			"Cute zombie sprite by CodeGeorge  http://codegeorge.deviantart.com/",
			"Renabomb sprite is inspired by Naqel 'deviant' http://naqel.deviantart.com/",
			"Textures are inspired by famous Golden Axe antic video game  http://en.wikipedia.org/wiki/Golden_Axe",
			"Boing sound by Augdog freesounder  http://www.freesound.org/people/Augdog/sounds/210188/",
			"Timer sound by maphill freesounder  http://www.freesound.org/people/maphill/sounds/204103/",
			"Drone A sound by sankalp freesounder  http://freesound.org/people/sankalp/sounds/153267/",
			"Wounded monster sound by Robinhood76 freesounder  http://www.freesound.org/people/Robinhood76/sounds/94281/",
			"Explosion sounds by sarge4267 freesounder  http://freesound.org/people/sarge4267/",
			"Success sounds by Grunz freesounder  http://freesound.org/people/grunz/",
			"Slap sound by Goldkechen freesounder  http://freesound.org/people/goldkelchen/sounds/217214/",
			"Guitar arpegio by plagasul freesounder  http://freesound.org/people/plagasul/sounds/1279/",
		}
		for _, text in ipairs(creditTexts) do
			local credit = TextField.new(font1, text)
			credit:setTextColor(0x5533AA)
			credit:setAlpha(0)
			credits:addChild(credit)
		end
		credits.floating = true
		credits.xSpeed = -1
		credits:setPosition(stageW, stageH - 4)
		credits.ichild = 1
		credits:getChildAt(1):setAlpha(1)
		level:addMovingChild(credits)
		function credits:iterate()
			self.xSpeed = -1 - (self:getX() > 0 and self:getX() / 50 or 0)
			if (self:getX() < - self:getChildAt(self.ichild):getWidth()) then
				self:getChildAt(self.ichild):setAlpha(0)
				self.ichild = self.ichild + 1
				self.ichild = self.ichild > self:getNumChildren() and 1 or self.ichild
				self:getChildAt(self.ichild):setAlpha(1)
				self:setX(stageW)
			end
		end
		_ = musicOn and sound('music', true):setVolume(1)


		if pauseIntro(1.5) then break end
		
		TapButton.new("Start")
		break
	end
	
	_ = credits and credits:stop()
	_ = txtRecord and txtRecord:stop()
	listB:stop()
	trophyB:stop()
	optionsB:stop()
	runModeB:stop()
	title:stop()
	titleBis:stop()

	_ = soundOn and sound('drone1', true):stop()
	_ = musicOn and sound('music', true):setVolume(1)

	if game.state == state.reseting or game.state == state.sharing then
		local alertDialog = AlertDialog.new(game.state == state.reseting and "All reset" or "Share Record",
			game.state == state.reseting and "Forget everything?" or "submit your best score on Reddit", "Cancel", game.state == state.reseting and "Reset now!" or "To Reddit!")
		local signal = {}
		alertDialog:addEventListener(Event.COMPLETE, function(event)
			if event.buttonIndex == 1 then
				if game.state == state.reseting then
					runMode = false
					record = 0
					runModeRecord = 0
					maxLevel = 1
					achievements = {}
				else
					application:openUrl("http://www.reddit.com/r/renabomb/submit?url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.squishytoy.renabomb&title=got%20score%20" .. record .. "%20playing%20Renabomb%20Vengeance")
				end
			end
			game:setState(state.intro)
		end)
		alertDialog:show()
		waitFor.condition(function() return game.state == state.intro end)
	elseif game.state == state.intro or game.state == state.continue then
		game.iLevel = firstLevel ~= 0 and firstLevel or 1
		score = 0
		totalRetry = 0
		trophies = {}
		remainingTime = firstLevel == 0 and 60 * 10 or 60 * 60
		prolongation = remainingTime
		game:setState(state.cinematic)
	end
end

function cinematic()
	function pauseCinematic(s)
		local w, event = waitFor.signal(Event.MOUSE_DOWN, s)
		return game.state ~= state.cinematic
	end

    level.floating = true
	level:setFading(0)
	level:resume()

	local scene = BitmapBody.new(Texture.new("city.png", false, {format = TextureBase.RGBA5551}))
	scene.floating = true
	scene:setAlpha(0)
	scene:setFading(1)
	scene:setAnchorPoint(0.1,0.04)
	scene:setScale(1.1, 1.1)
	scene:resume()
	scene.zoom = -0.00035
	scene.xSpeed = -0.2
	stage:addChildAt(scene, stage:getChildIndex(stage.particles))

    runningRena = BitmapBody.new(runningRegions[1])
	runningRena:setScale(4, 4)
	runningRena.floating = true
	runningRena:setTextureLoop(runningRegions, 5)
	runningRena:setPosition(stageW * 0.2, stageH * 0.4)
	runningRena.xSpeed = 0.2
	scene:addMovingChild(runningRena)

	while not runMode do
		_= musicOn and sound('music', true):setVolume(0)
		_= musicOn and sound('arpegio'):setLooping(true)
	
		if pauseCinematic(1) then break end
		bill(180, 380, "Here is", 0x2222DD, 3)
		if pauseCinematic(1) then break end
		bill(180, 390, "Renabomb!", 0x0000FF, 5)
		if pauseCinematic(2) then break end
		-- scene.zoom = 0
		if pauseCinematic(1) then break end
		bill(180, 100, "She's passionate", 0x0000FF, 3)
		bill(190, 150, "about", 0x2222DD, 4)
		if pauseCinematic(2) then break end
		bill(180, 360, "her boyfriend,", 0xFF00DD, 3)
		if pauseCinematic(1) then break end
		bill(180, 400, "and bombs!", 0xFF0000, 5)
		if pauseCinematic(3) then break end
		scene.fade = -0.03
		runningRena:setTtl(40)
		scene:setTtl(40)
		bill(160, 100, "but", 0x0000FF, 4)
		bill(160, 150, "one day,", 0x2222DD, 3)
		if pauseCinematic(2) then break end
		bill(140, 200, "cute zombies", 0xFF00FF, 6)
		if pauseCinematic(1.5) then break end
		bill(170, 250, "invaded", 0xFF00FF, 4)
		_= soundOn and sound('monsterDying', false):setPitch(0.8)
		if pauseCinematic(0.5) then break end
		bill(170, 280, "her high school", 0xFF55FF, 5)
		_= soundOn and sound('monsterDying', false):setPitch(1)
		
		if pauseCinematic(1.5) then break end
		bill(160, 300, "and kidnapped", 0x0FF, 5)
		if pauseCinematic(0.5) then break end
		bill(160, 350, "her boyfriend!", 0x0FF, 5)
		if pauseCinematic(1) then break end
		level:setFading(1, 0, 0.009)
		bill(160, 100, "It's time ...", 0xFF6600, 5)
		if pauseCinematic(2) then break end
		bill(160, 100, "for", 0xFF3333, 5)
		bill(160, 130, "Vengeance!", 0xFF0000, 8)
		_= musicOn and sound('arpegio', true):stop()
		_= musicOn and sound('music', true):setPosition(38500)
		if pauseCinematic(5) then break end
		TapButton.new("Start")
		break
	end

	while runMode do
		b = bill(180, 160, "3", 0x2222DD, 15)
		scene:addChild(b)
		waitFor.seconds(1)
		b = bill(180, 180, "2", 0x2222DD, 15)
		scene:addChild(b)
		waitFor.seconds(1)
		b = bill(180, 200, "1", 0x2222DD, 15)
		scene:addChild(b)
		waitFor.seconds(1)
		break
	end

	runningRena:freeze()
	scene:stop()
	level:setAlpha(1)
	level:freeze()
	_= musicOn and sound('arpegio', true):stop()
	_= musicOn and sound('music', true):setVolume(0.5)

end


function moveToCurrentLevel()
	local h = stageH
	local yl = -h
	local previousLevel = level
	local newLevel = Level.new(game.iLevel)
	
	newLevel.floating = true
	newLevel.name = "level" .. newLevel.i
	newLevel:focus()
	newLevel.previous = previousLevel
	if previousLevel == nil or previousLevel.i == 0 or previousLevel.i >= newLevel.i then
		newLevel:setAlpha(0)
		maskStage(function()
				_ = newLevel.previous and newLevel.previous:finalize()
				newLevel.previous = nil
				newLevel:setAlpha(1)
				unmaskStage()
		end)
		waitFor.seconds(0.2)
		return
	end
	newLevel:setY(-stageH)
	newLevel:resume()
	application:setBackgroundColor(0xFFFFFF)
	function levelToastInAnimation(self)
	--	print("toastIn", yl, by)
	   local by = self.background:getY() - stageH / 2
	   local step = 4 + 30 * math.abs(1 - math.abs(-yl -yl -h)  / h)
	   if (yl < -1) then
	       self.background:setY(self.background:getY() - step * 0.7)
		   self.previous.background:setY(self.previous.background:getY() - step * 0.7)
		   yl = yl + step
		   self.previous:setY(self.previous:getY() + step)
		   -- self.previous:setAlpha(self.previous:getAlpha() * 0.97)
		   self:setY(yl)
	   elseif by < -3 then
		   self.previous.background:setY(stageH / 2 + (self.previous.background:getY()  - stageH / 2) * 0.9)
		   self.background:setY(stageH / 2 + by * 0.9)
	   else
		   self.background:setY(stageH / 2)
		   self.animations.toastIn = nil
		   self:setY(0)
		   self:freeze()
		   self.previous:finalize()
		   self.previous = nil
	   end
	end
   if previousLevel then previousLevel.animations = {} end
   newLevel.animations.toastIn = levelToastInAnimation
	
end

function levelIntro(aLevel)
	local levelTitle = Body.new()
	
	local levelTitleBg = Bitmap.new(textureMacaron);
	levelTitleBg:setAnchorPoint(0.5, 0.5)
	levelTitleBg:setScale(0.25, 0.25)
	
	local levelTitleTxt = TextField.new(font1, runMode and "Go" or "Level")
	levelTitleTxt:setX(-levelTitleTxt:getWidth() / 2)
	levelTitleTxt:setY(levelTitleTxt:getHeight()  * -1.03)
	levelTitleTxt:setTextColor(0xfbfc5c)
	
	local levelTitleTxt2 = TextField.new(font1, runMode and "!" or aLevel.i)
	levelTitleTxt2:setX(levelTitleTxt2:getWidth() * (aLevel.i < 10 and -0.45 or -0.5))
	levelTitleTxt2:setY(levelTitleTxt:getHeight() * 0.56)
	levelTitleTxt2:setTextColor(0xfbfc5c)
	
	levelTitle:addChild(levelTitleBg)
	levelTitle:addChild(levelTitleTxt)
	levelTitle:addChild(levelTitleTxt2)
	
	if not runMode and aLevel.title ~= nil then
		local levelTitleTxt3 = TextField.new(font1, "''" .. aLevel.title .. "''")
		levelTitleTxt3:setX(-levelTitleTxt3:getWidth() / 2)
		levelTitleTxt3:setY(levelTitleTxt:getHeight() * 2.56)
		levelTitleTxt3:setTextColor(0xff0000)
		levelTitle:addChild(levelTitleTxt3)
	end
	
	levelTitle:setPosition(stageW / 2, stageH * 0.4)
	levelTitle.floating = true
	levelTitle:setScale(30)
	levelTitle.zoom = -0.8
	levelTitle.name = "levelTitle"
	function levelTitle:iterate()
		if (self:getScaleX() < 2.6) then
			self.ySpeed = self.ySpeed - 0.02
			
			self.zoom = -0.02
			self.fade = -0.01
			self:setTtl(40)
		elseif (self:getScaleX() > 3) then
			self.zoom = - 0.03 - 0.1 * (self:getScaleX() - 3)
		end
	end
	aLevel:addMovingChild(levelTitle)


end

function isOutOfGame()
	return game.state ~= state.ingame or level.zombiCount == 0
end

function inGame()
	
	_= musicOn and sound('music', true):setVolume(0.5)
	lastRemainingTime = remainingTime
	lastScore = score
	lastTrophies = {}
	for _, trophy in pairs(trophies) do
	   table.insert(lastTrophies, trophy)
	end
	
	local i0game = Body.iteration
	local hint = not runMode and level.hint or nil
	while game.running and (game.state == state.ingame or game.state == state.restarting) do
		if game.state == state.restarting then
			local alertDialog = AlertDialog.new("End game", "GAME OVER?", "No", "Yes")
			local signal = {}
			alertDialog:addEventListener(Event.COMPLETE, function(event)
				game:setState(event.buttonIndex == 1 and state.intro or state.ingame)
			end)
			alertDialog:show()
			waitFor.condition(function() return game.state ~= state.restarting end)
		
		elseif game.state == state.ingame then
			if level.zombiCount == 0 then
				game:setState(state.success)
			else
				if hint ~= nil then
					game:waitStateCondition(isOutOfGame, hint.time * timeRate)
					if hint.time <= (Body.iteration - i0game) then
						_ = Caption.new(hint.x, hint.y, hint.xc, hint.yc, hint.txt1, hint.txt2)
						i0game = Body.iteration
						hint = hint.next
					end
				else
					game:waitStateCondition(isOutOfGame)
				end
			end
		end
	end
end

function showTrophy()
	_= musicOn and sound('music', true):setVolume(0)
	_= musicOn and sound('arpegio'):setLooping(true)

	achievementsGui = Body.new()
	achievementsGui.floating = true
	local achievementList = {
		{id="first10", label="10/10", caption1="Win 10", caption2="levels"},
		{id="runningUnlocked", label="20/20", caption1="win 20", caption2="levels"},
		{id="first30", label="30/30", caption1="Win 30", caption2="levels"},
		{id="first40", label="40/40", caption1="Win 40", caption2="levels"},
		{id="first50", label="50/50", caption1="Win 50", caption2="levels"},
		{id="gameEnd", label="King", caption1="Beat", caption2="King Z"},
		{id="allTrophy", label="Trophies", caption1="get back", caption2="all hats"},
		{id="run26", label="run 26", caption1="Run 26", caption2="levels"}, 
		{id="run42", label="run 42", caption1="Run 42", caption2="levels"},
		{id="runningFinished", label="Finish", caption1="Run to", caption2="the Finish"},
		{id="perfectWin", label="Perfect", caption1="Finish with", caption2="all hats"},
		{id="incredibleWin", label="Incredible", caption1="Finish in", caption2="3 retry"}
	}
	local i
	local missing = 0
	for i = 1,#achievementList do
		local a = achievementList[i]
		local achievementTrophyB = BitmapBody.new(textureTrophy)
		achievementTrophyB.floating = true
		achievementTrophyB.achievement = a

 		achievementTrophyB:setAnchorPoint(0.5, 0.4)
		achievementTrophyB:setScale(0.2)
		local x, y = ((i - 1) % 3) * stageW / 3 + stageW / 6, stageH * math.ceil(i / 3) * 0.2 - stageH * 0.1
		achievementTrophyB:setPosition(x, y)
 		achievementsGui:addChild(achievementTrophyB)

		if achievements[a.id] then
			local achieved = BitmapBody.new(textureStar)
			achieved.floating = true
			achieved.volume = 10 * (1 + (i * 0.2))
			achieved.iterate = scintille
			achieved:setColorTransform(1, 1, 0, 1)
			achieved:setScale(2.5)
			achieved:setAnchorPoint(0.5, 0.52)
			achievementTrophyB:addMovingChild(achieved)
		else
			achievementTrophyB:setColorTransform(0.4,0.2,0.2,0.4)
			missing = missing + 1
		end

		local achievementTxt = TextField.new(font1, a.label)
		achievementTxt:setPosition(x - achievementTxt:getWidth() * 0.5, y + 20)
		achievementTxt:setTextColor(0x0000aa)
 		achievementsGui:addChild(achievementTxt)
	end

	local tapButton = Body.new()
	local tapButtonBg = Bitmap.new(textureButton)
	tapButtonBg:setAnchorPoint(0.5, 0.5)
	tapButtonBg:setScale(0.6)
	tapButton:addChild(tapButtonBg)
	local tapButtonTxt = TextField.new(font1, "Tap &")
	local tapButtonTxt2 = TextField.new(font1, missing > 0 and "do better" or "die happy")
	tapButton:addChild(tapButtonTxt)
	tapButton:addChild(tapButtonTxt2)
	tapButtonTxt:setX(-tapButtonTxt:getWidth() / 2)
	tapButtonTxt2:setX(-tapButtonTxt2:getWidth() / 2)
	tapButtonTxt2:setY(tapButtonTxt:getHeight())
	tapButtonTxt2:setTextColor(0xFFFF00)
	tapButtonTxt:setTextColor(0xFFFF00)
	tapButton:setPosition(stageW / 2, 0.9 * stageH)
	tapButton.floating = true
	function tapButton:iterate()
		self.zoom = 0.03 * math.cos((Body.iteration - self.i0) / 10 * math.pi)
	end

	maskStage(function()
		level:addChild(achievementsGui)
		stage:addMovingChild(tapButton)
		unmaskStage()
	end)
	waitFor.seconds(1)
	eventType, event = waitFor.signal(Event.MOUSE_DOWN)
		
	while game.running do
		for i=1,achievementsGui:getNumChildren() do
			local c = achievementsGui:getChildAt(i)
			if c.achievement then
				local a = c.achievement
				if c:hitTestPoint(event.x, event.y) then
				   c.animations.click = clickMotion0
				   c:resume()
				   Caption.new(c:getX(), c:getY(), c:getX(), c:getY(), a.caption1, a.caption2)
				end
			end
		end
		if tapButton:hitTestPoint(event.x, event.y) then
			break
		end
		eventType, event = waitFor.signal(Event.MOUSE_DOWN)
	end

	_= musicOn and sound('arpegio', true):stop()
	achievementsGui:stop(true)
	tapButton:stop()
	game:setState(state.intro)
end

function selectLevel()

	if maxLevel > #levels then maxLevel = #levels end
	
	_= soundOn and sound('success-high'):setPitch(4)

	
    _= musicOn and sound('music', true):setVolume(0)
	if level ~= nil then
		level:finalize()
		stage.gravity = 0
		game.iLevel = 0
	end

	listGui = Body.new()
	listGui.floating = true
	listGui.buttons = BitmapBody.new(textureListGui)
	listGui.buttons.floating = true
	listGui.buttons:setAlpha(0.5)
	listGui.buttons:setY(340)
	function listGui.buttons:iterate()
		self:setX(self:getX()* 0.75)
		_ = listGui.browseLevel and listGui.browseLevel:setX(self:getX() * 4)
	end
	listGui:resume()
	local hexagons = Bitmap.new(Texture.new("hexagons.png", false, {format = TextureBase.RGBA5551}))
	hexagons:setAlpha(0.5)
	hexagons:setScale(1.1)
	hexagons:setPosition(stageW / 2, stageH / 2)
	hexagons:setAnchorPoint(0.5, 0.5)
	hexagons:setBlendMode(Sprite.MULTIPLY)
	
	stage:addChildAt(listGui, stage:getChildIndex(stage.particles))
	stage:addChildAt(hexagons, stage:getChildIndex(stage.particles))
	stage:addMovingChild(listGui.buttons, stage:getChildIndex(stage.particles))
	local iLevel = maxLevel
	listGui.browseLevel = Level.new(iLevel)
	

	listGui:addChild(listGui.browseLevel)
	

	levelIntro(listGui.browseLevel)

	eventType, event = waitFor.signal(Event.MOUSE_DOWN)
		
	while game.running and listGui:hitTestPoint(event.x, event.y) do
		if event.x > stageW * 0.4 and event.x < stageW * 0.6 then
			break
		end
		
		_= soundOn and sound('success-high'):setPitch(5)
		if event.x > stageW / 2 then
			iLevel = iLevel + 1
			if iLevel > maxLevel then
			   iLevel = 1
			end

			listGui.buttons:setX(140)
		else
			iLevel = iLevel - 1
			if iLevel < 1 then
			   iLevel = maxLevel
			end
			listGui.buttons:setX(-140)
		end
		
		listGui.browseLevel:finalize()
		listGui.browseLevel = Level.new(iLevel)
		listGui:addChild(listGui.browseLevel)
		levelIntro(listGui.browseLevel)
		
		eventType, event = waitFor.signal(Event.MOUSE_DOWN)
	end
	listGui.browseLevel:finalize()
	stage:removeMovingChild(listGui.buttons)
	stage:removeMovingChild(listGui)
	stage:removeChild(hexagons)
	score = 0
	totalRetry = 0
	retryCounter = 0
	trophies = {}
	setRunMode(false)
	game.iLevel = iLevel
	game:setState(state.ingame)
	-- _= soundOn and sound('success-high')
end

function successScene()

    resetSounds()
	_= musicOn and sound('music', true):setVolume(0)
	
	local pop = Body.new()
	

	local popBg = BitmapBody.new(textureMacaron);
	popBg:setAnchorPoint(0.5, 0.5)
	popBg.floating = true
	popBg.angleSpeed = 1
	pop:addMovingChild(popBg)

	local txt = runMode and "Run! Run!!" or (level.zombiCount == 0 and "Nailed it!" or "Ready?")
	local popTxt = TextField.new(font1, txt)
	popTxt:setPosition(-popTxt:getWidth() * 0.5 +5, -5)
	popTxt:setTextColor(0xfffc5c)
	pop:addChild(popTxt)

    popTrophies = Sprite:new()
	popTrophies:setX(popBg:getWidth() * -0.46)
	pop:addChild(popTrophies)
	yHat = 0
	for _, trophy in pairs(trophies) do
		local hat = Bitmap.new(zombiHatsRegions[trophy])
		hat:setY(yHat)
		popTrophies:addChild(hat)
		yHat = yHat - 10
	end
	popTrophies:setY(yHat * -0.5 - 80)
	
	local bonus = 0
	local popTxt2
	if (level.zombiCount == 0) then
		popTxt2 = TextField.new(font1, "Bonus           ")
		pop:addChild(popTxt2)
		popTxt2:setX(-popTxt2:getWidth() / 2)
		popTxt2:setY(popTxt:getHeight())
		popTxt2:setTextColor(0xff2200)
	end
	
	pop:setPosition(stageW / 2, stageH / 2.7)
	pop.floating = true
	pop.xSpeed = 0
	pop.ySpeed = 0
	pop:setRotation(not runMode and 180 or 0)
	pop.angleSpeed = not runMode and 32 or 0
	pop.name = "success"
	function pop:iterate()
	    local s = -0.2 + 2 * (Body.iteration - self.i0) / (3 + (Body.iteration - self.i0))
		if (self.angleSpeed > 5) then
			self.angleSpeed = self.angleSpeed - 1
			self:setScale(s, s) 
		elseif (math.abs(self:getRotation() % 360) < 15) then
			self:setRotation(0)
			self:setScale(1.6, 1.6)
			self.angleSpeed = 0
			self.iterate = nil
		end
	end
	stage:addChildAt(pop, stage:getChildIndex(stage.particles))
	pop:resume()
	
	_ = game.state == state.success and (not runMode) and waitFor.seconds(0.5)
	-- bling(x, y, xs, ys, volume)
	if (popTxt2 ~= nil) then
		popTxt2:setText("  No Bonus")
		schoolbag.name = "schoolbag"
		schoolbag.iterate = function()
			local d = (stageH - 50 - schoolbag:getY())
			schoolbag.ySpeed =  d / 20
			schoolbag:setScale(0.4 + d / 180)
		end
		
		if ammo > 0 then
			ammo = ammo - 1
			schoolbag:setY(stageH - 150)
			txtAmmo:setText(string.format("%02d @", ammo))
			_ = runMode or bling(0, 0, 0, -2, 3, false, popBg)
			popTxt2:setText("Bonus 100")
			bill(pop:getX(), pop:getY() - 30, "100", 0x002299, 5)
			popTxt2:setX(-popTxt2:getWidth() / 2)
			score = score + 100
			if soundOn then sound('success-low') end
		end
		_ = game.state == state.success and (not runMode) and waitFor.seconds(0.6)
		if ammo > 0 then
			ammo = ammo - 1
			schoolbag:setY(stageH - 150)
			txtAmmo:setText(string.format("%02d @", ammo))
			bill(pop:getX(), pop:getY() - 40, "500", 0x0044BB, 6)
			popTxt2:setText("Bonus 500")
			popTxt2:setX(-popTxt2:getWidth() / 2)
			_ = runMode or bling(0, 0, 0, -2, 5, false, popBg)
			score = score + 500
			if soundOn then sound('success-low'):setPitch(1.1) end
		end
		_ = game.state == state.success and (not runMode) and waitFor.seconds(0.6)
		if ammo > 0 then
			ammo = ammo - 1
			schoolbag:setY(stageH - 150)
			txtAmmo:setText(string.format("%02d @", ammo))
			bill(pop:getX(), pop:getY() - 50, "1000", 0x00AAEE, 7)
			popTxt2:setText("Bonus 1000")
			popTxt2:setX(-popTxt2:getWidth() / 2)
			_ = runMode or bling(0, 0, 0, -2, 10, false, popBg)
			score = score + 1000
			if soundOn then sound("success-low"):setPitch(1.34) end
		end
		_ = game.state == state.success and (not runMode) and waitFor.seconds(0.6)
		if ammo > 0 then
			score = score + ammo * 50
			bonus = 1000 + ammo * 50
			ammo = 0
			schoolbag:setY(stageH - 150)
			txtAmmo:setText(string.format("%02d @", ammo))
			bill(pop:getX(), pop:getY() - 60, "" .. bonus, 0x00EEFF, 12)
			popTxt2:setText("Bonus " .. bonus)
			popTxt2:setX(-popTxt2:getWidth() / 2)
			_ = runMode or bling(0, 0, 0, -2, 15, false, popBg)
			if soundOn then sound("success-high") end
		end
		
		if not runMode and record < score then
			record = score

			local txtRecordTxt = TextField.new(font1, "HighScore!")
			txtRecordTxt:setX(-txtRecordTxt:getWidth() / 2)
			txtRecordTxt:setY(popTxt:getHeight() * 2.3)
			txtRecordTxt:setTextColor(0xffff00)
				
			local highStar = BitmapBody.new(textureStar)
			highStar:setAnchorPoint(0.5, 0.5)
			highStar:setBlendMode(Sprite.ADD)

			highStar:setScale(0.5)
			highStar:setTtl(200)
			highStar:setSpeed(txtRecordTxt:getWidth() / 200, 0)
			highStar.angleSpeed = 1
			highStar.zoom = 0.002
			highStar.floating = true
			highStar:setPosition(-txtRecordTxt:getWidth() / 2,
								 popTxt:getHeight() * 2)
			highStar.name = "highStar"
			function highStar:iterate()
			   txtRecordTxt:setAlpha(0.5 + 0.5 * math.random())
			   self:setScale(0.1 + 0.3 * math.random())
			end
			pop:addChild(txtRecordTxt)
			pop:addMovingChild(highStar)
		end
		
		_ = game.state == state.success and (not runMode) and waitFor.seconds(1)
		schoolbag:setY(stageH - 60)
		schoolbag:setScale(0.4)
		schoolbag.ySpeed = 0
		schoolbag.iterate = nil
	else
		_ = game.state == state.success and (not runMode) and waitFor.seconds(0.5)
	end
	
	if level ~= nil and level.i < #levels then
		rena:setWorld(nil)
		rena:setTextureLoop(endJumpingRegions)
		rena.ySpeed = -20
		rena.gravity = 0
		bling(rena:getX(), rena:getY(), 0, 20, 5)
	end
		
	if level and maxLevel <= level.i then
		maxLevel = level.i + 1
	end

	if not achievements.runningUnlocked and maxLevel >= 21 then
		achievements.runningUnlocked = true
		achievement("running", "unlocked!")
		setRunMode(false) -- pas true sinon on déclenche dans la partie courante
	end

	if not achievements.first10 and maxLevel >= 11 then
		achievements.first10 = true
		achievement("10/10", "success")
	end

	if not achievements.first30 and maxLevel >= 31 then
		achievements.first30 = true
		achievement("30/30", "success")
	end

	if not achievements.first40 and maxLevel >= 41 then
		achievements.first40 = true
		achievement("40/40", "success")
	end

	if not achievements.first50 and maxLevel >= 51 then
		achievements.first50 = true
		achievement("50/50", "success")
	end

	if not achievements.run26 and runMode and maxLevel >= 27 then
		achievements.run26 = true
		achievement("run 26", "success")
	end

	if not achievements.run42 and runMode and maxLevel >= 43 then
		achievements.run42 = true
		achievement("run 42", "success")
	end

	saveMe()
	
	_= musicOn and sound('music', true):setVolume(1)
	
	if game.state == state.success and not runMode then
		TapButton.new("Play #" .. level.i + 1)
	end
	
	--pop.fade = -0.001
	pop.iterate = nil
	popBg:freeze()
	pop.zoom = 0.04
	pop.fade = -0.025
	pop:setTtl(40)
	
	if game.state == state.restarting then
		local alertDialog = AlertDialog.new("End game", "GAME OVER?", "No", "Yes")
		alertDialog:addEventListener(Event.COMPLETE, function(event)
			game:setState(event.buttonIndex == 1 and state.intro or state.success)
		end)
		alertDialog:show()
		waitFor.condition(function() return game.state ~= state.restarting end)
	end

	if game.state == state.success then
		game.state = state.continue
	end
end


function timeoutScene()
	local win = (game.iLevel == #levels and (not runMode or remainingTime > 0))
	_= musicOn and sound('music', true):setVolume(0)
	if win then
		local bonus = runMode and (remainingTime * 10) or 1000000
		score = score + bonus 
		bill(stageW / 2, stageH, "" .. bonus, 0x00FFFF, 5)
	end
	

	local pop = Body.new()
	
	local popTxt3
	
	local popBg = BitmapBody.new(textureMacaron);
	_ = not win and popBg:setColorTransform(5, 0.5 , 0.5, 1)
	popBg:setAnchorPoint(0.5, 0.5)
	popBg.floating = true
	popBg.angleSpeed = 0.25
	pop:addMovingChild(popBg)

	local popTxt = TextField.new(font1, win and "Victory" or "Time Out")
	popTxt:setScale(2)
	popTxt:setPosition(-popTxt:getWidth() / 2, -popTxt:getHeight() / 2 - 5)
	popTxt:setTextColor(0xff0000)
	pop:addChild(popTxt)

	
	
	local popTxt2
	local txt2
	if not win then
		txt2 = "at level " .. game.iLevel
	elseif runMode then
	    local secondsToClock = function(nSeconds)
			if nSeconds <= 0 then
				--return nil;
				return "00:00:00";
			else
				nHours = string.format("%02.f", math.floor(nSeconds/3600));
				nMins = string.format("%02.f", math.floor(nSeconds/60 - (nHours*60)));
				nSecs = string.format("%02.f", math.floor(nSeconds - nHours*3600 - nMins *60));
				return nHours..":"..nMins..":"..nSecs
			end
		end
		txt2 = secondsToClock(((win and remainingTime or 0) + prolongation) / 60) .. " total"
	elseif not achievements.runningFinished then
		txt2 = "Now Run!"
	else
		txt2 = "Well done!"
	end
	popTxt2 = TextField.new(font1, txt2)
	
	pop:addChild(popTxt2)
	popTxt2:setX(-popTxt2:getWidth() / 2)
	popTxt2:setY(0)
	popTxt2:setTextColor(0xffdd00)
	
	
	popTxt3 = TextField.new(font1, "score " .. score)
	pop:addChild(popTxt3)
	popTxt3:setX(-popTxt3:getWidth() / 2)
	popTxt3:setY(popTxt2:getHeight())
	popTxt3:setTextColor(0xff2200)
	
	pop:setPosition(stageW / 2, stageH / 2.7)
	pop.floating = true
	pop.xSpeed = 0
	pop.ySpeed = 0
	pop:setRotation(180)
	pop.angleSpeed = 20
	pop.name = "timeout"
	function pop:iterate()
	    local s = -0.3 + 2 * (Body.iteration - self.i0) / (3 + (Body.iteration - self.i0))
		if (self.angleSpeed > 5) then
			self.angleSpeed = self.angleSpeed - 0.25
			self:setScale(s, s) 
		elseif (math.abs(self:getRotation() % 360) < 15) then
			self:setRotation(0)
			self:setScale(1.6, 1.6)
			self.angleSpeed = 0
			self.iterate = nil
		end
	end
	level:addMovingChild(pop)

	local highStar = BitmapBody.new(textureStar)
	if runMode and runModeRecord < score or not runMode and record < score then
		if runMode then
			runModeRecord = score
		else
			record = score
		end
		
		local txtRecordTxt = TextField.new(font1, "HighScore!")
		txtRecordTxt:setX(-txtRecordTxt:getWidth() / 2)
		txtRecordTxt:setY(popTxt2:getHeight() * 3)
		txtRecordTxt:setTextColor(0xffffaa)
		highStar.floating = true
		highStar.angleSpeed = 1
		highStar:setAnchorPoint(0.5, 0.5)
		highStar:setBlendMode(Sprite.ADD)
		highStar:setScale(1)
		highStar:setAlpha(0.8)
		highStar:setPosition(-txtRecordTxt:getWidth() * 0.6, popTxt2:getHeight() * 3)
		highStar.volume = 6
		highStar.iterate = scintille
			
		pop:addChild(txtRecordTxt)
		pop:addMovingChild(highStar)
	end
	
	saveMe()
	_ = not win and waitFor.condition(function() return level.zombiCount == 0 end, 8)
	if win then
		while level.zombiLayer:getNumChildren() > 0 do
			local zombi = level.zombiLayer:getChildAt(1)
			zombi:setState(state.dead)
		end
		waitFor.seconds(12)
		TapButton.new("Exult")
		game:setState(state.intro)
	elseif level.zombiCount == 0 then
		game:setState(state.success)
	else
		while game.running and level.zombiLayer:getNumChildren() > 0 do
			local zombi = level.zombiLayer:getChildAt(1)
			zombi:setState(state.dead)
		end
		TapButton.new("Cry")
		game:setState(state.intro)
	end
	pop.iterate = nil
	popBg:freeze()
	highStar:freeze()
	pop.zoom = 0.04
	pop.fade = -0.025
	pop:setTtl(40)
end

function splashScreen()
	--- splash screen
	local splash = BitmapBody.new(Texture.new("logo.png", false))
	splash:setScale(1.1)
	splash:setAnchorPoint(0.5, 0.5)
	splash:setPosition(stageW / 2, stageH / 2)
	stage:addChildAt(splash, 1)
	

	application:setBackgroundColor(0xFFFFFF)
	splash:setFading(1, 0, 0.1)
	splash.floating = true
	splash:resume()
	local squishy = BitmapBody.new(Texture.new("squishy.png", false, {format = TextureBase.RGBA5551}))
	squishy:setAnchorPoint(0.5, 0.5)
	squishy.floating = false
	-- squishy.gravity = 0.5
	local drool = BitmapBody.new(Texture.new("drool.png", false, {format = TextureBase.RGBA4444}))
	drool:setAlpha(0)
	drool:setAnchorPoint(0.45, 0.65)
	drool:setScale(0.6, 0.6)
	squishy:setScaleY(1.2)
	squishy:setPosition(0, - 2 * squishy:getHeight())
	_= soundOn and sound('squeak')
	waitFor.seconds(0.5)
	squishy.gravity=1
	squishy:setSpeed(0, 10)
	--squishy.acceleration=0.001
	drool:setPosition(0, squishy:getHeight() * 0.45)
	splash:addMovingChild(drool)
	splash:addMovingChild(squishy)
	waitFor.condition(function() return squishy:getY() > 10 end)
	squishy.gravity = 0.1
	squishy:setSpeed(0, -1)
	drool:setAlpha(0.2)
	drool:setSpeed(0.02, 0.02)
	squishy:setScaleY(0.9)
	_= soundOn and sound('prrt')
	drool.fade = 0.001
	drool.zoom = 0.04
	function drool:iterate()
		self.zoom = self.zoom * 0.93
	end
	waitFor.seconds(0.4)
	squishy.gravity = 0
	squishy:setSpeed(0, 0)
	waitFor.seconds(0.3)
	squishy:stop()
	drool:stop()
	splash:setFading(0, 1, -0.1)
	waitFor.seconds(0.5)
	splash:stop()
end


function main()
 	
    game:setState(((save.state == 'ingame') and state.ingame
				     or (save.state == 'success') and state.success
				     or state.intro))

    if game.state == state.intro then
		splashScreen()
	end
	splash = nil

	if game.iLevel > #levels then game.iLevel = #levels end
	if game.state == state.success then
		moveToCurrentLevel();
		setGuiState(state.success)
	end
	
	-- print("music", musicOn)
	if musicOn then
		local m = sound('music')
		m:setLooping(true)
		m:setVolume(0)
	end

	waitFor.seconds(0)
	while game.running do

		if game.state == state.intro then
			retryCounter = 0
			setGuiState(state.intro)
			intro()
		elseif game.state == state.cinematic then
			cinematic()
			_ = (game.state == state.cinematic or game.state == state.continue) and game:setState(state.ingame)
		elseif game.state == state.browsing then
			selectLevel()
		elseif game.state == state.trophy then
			showTrophy()
		elseif game.state == state.ingame then
			moveToCurrentLevel()
			if alternateGuiLayouts[game.iLevel] then
				recycleB:setY(stageH - 60)
				exitB:setY(stageH - 60)
				continueB:setY(stageH - 60)
			else
				recycleB:setY(40)
				exitB:setY(40)
				continueB:setY(40)
			end
			_ = game.guiState ~= state.activated and setGuiState(state.idle)
			_= willHideAdTimer and willHideAdTimer:stop()
			willHideAdTimer = nil
			if withAd and adIsVisible then
				willHideAdTimer = Timer.delayedCall(10000, function()
					adIsVisible = false
					admob.setVisible(false)
				end)
			end
		
			if runMode then
				_ = level.i == 1 and levelIntro(level)

				local t = math.floor(remainingTime  / 60)
				timer.txt:setTextColor(t <= 10 and 0xff0000 or 0xfbfc5c)
				timer.txt:setText(string.format("%02d", t))

				if retryCounter == 0 and level.i > 1 then
					local par = (level.par or 20) 
					local extra = 60 * par
					prolongation = prolongation + extra
					remainingTime = remainingTime + extra
					timer.txt:setTextColor(0xfbfc5c)
					waitFor.seconds(0.5)
					bill(timer:getX(), timer:getY(), "+" .. par, 0xaaff00, 10)
				end
			elseif level.tuto and retryCounter == 0 then
				game:setState(state.tuto)
				setGuiState(state.tuto)
				local tuto = BitmapBody.new(Texture.new(level.tuto, false))
				tuto:setAnchorPoint(0.5, 0.5)
				tuto.floating=true
				tuto:setPosition(stageW / 2, stageH / 2)
				tuto:setScale(1.1)
				tuto:setAlpha(0)
				tuto.fade = 0.05
				tuto:resume()
				local billTxt
				maskStage(function()
					stage:addChildAt(tuto, stage:getChildIndex(frame))
					if level.tutoTxt then
					 	billTxt = bill(stageW / 2, stageH * 0.85, level.tutoTxt, 0xFF0000, 10)
					end
					unmaskStage()
				end)
	
				local b = TapButton.new('Try', 0,  stageH * 0.35, 0.3, tuto)
				maskStage(function()
					tuto:stop()
					_ = billTxt and billTxt:stop()
					unmaskStage(function()
						setGuiState(state.idle)
					end)
				end)
				levelIntro(level)
				game:setState(state.ingame)
			else
				levelIntro(level)
			end
	
			inGame()
			
			pendingFires = {}
			
			sound('timer0', true):stop()
			
			_= willShowAdTimer and willShowAdTimer:stop()
			willShowAdTimer = nil

			schoolbag:setX(stageW - 40)
		
		elseif game.state == state.timeout then
			setGuiState(state.timeout)

			if withAd and game.iLevel > 3 then
				adIsVisible = true
				admob.setVisible(true)
			end

			timeoutScene()

		elseif game.state == state.success and level.i == #levels then
			if runMode then
				if not achievements.runningFinished then
					achievements.runningFinished = true
					achievement("Finish", "Success!")
				end
				if #trophies == hatCount and not achievements.perfectWin then
					achievements.perfectWin = true
					achievement("Perfect", "Success!")
				end
				if totalRetry <= 3 then
					achievements.incredibleWin = true
					achievement("Incredible", "Success!")
					Caption.new(stageW * 0.75, stageH * 0.75, stageW * 0.75, stageH * 0.75, (totalRetry == 0 and "never failed" or ("" .. totalRetry .. " retry")), totalRetry == 0 and "failed" or "only")
				end
			else
				if not achievements.gameEnd then
					achievements.gameEnd = true
					achievement("King", "Success!")
				end
			end
			game:setState(state.timeout)

		elseif game.state == state.success then	
			setGuiState(state.success)
			if not runMode and withAd and game.iLevel > 3 then
				adIsVisible = true
				admob.setVisible(true)
			end

			successScene()

			if game.state == state.continue then
				game.iLevel = game.iLevel + 1
				game:setState(state.ingame)
				retryCounter = 0
			end

		elseif game.state == state.retrying then
			score = lastScore
			trophies = lastTrophies
			game:setState(state.ingame)
			retryCounter = retryCounter + 1
			totalRetry = totalRetry + 1
			if not runMode and withAd and game.iLevel > 3 then
				adIsVisible = true
				admob.setVisible(true)
			end
			bill(recycleB:getX(), recycleB:getY()+10, string.format("%d", totalRetry), 0xAAAADD, 6)
		
		else
			print('buggg', game.state.label)
			waitFor.seconds(0)
		end

	end

end

if false then
	-- testu
	local platform = BitmapBody.new(textureDirt)
	platform:setPosition(0, 350)
	platform:setWorld(Body.stage, Body.BLOCK, true)
	stage:addMovingChild(platform);
	local ball = BitmapBody.new(bombRegion1)
	ball:setSpeed(1, 2)
	ball:setPosition(100, 100);
	ball:setWorld(Body.stage, Body.BALL, false)
	ball.acceleration = -0.06
	-- ball.floating = true
	stage:addMovingChild(ball);

	function onEnterFrame(event)
		Body.animate()
	end
end

if application:getDeviceInfo() == "Win32" then
	local checkEveryNowAndThen = 0
	stage:addEventListener(Event.ENTER_FRAME, function(event)
		checkEveryNowAndThen = checkEveryNowAndThen + 1
		if checkEveryNowAndThen < 60 then
			return
		end
		checkEveryNowAndThen = 0
		application:setOrientation(application:getDeviceOrientation())
		if application:getDeviceOrientation() == application.PORTRAIT then
			application:setLogicalDimensions(320, 480)
		else
			application:setLogicalDimensions(480, 320)
		end
	end)
end

stage:addEventListener(Event.ENTER_FRAME, onEnterFrame)
stage:addEventListener(Event.APPLICATION_EXIT, function(event)
	stage:removeEventListener(Event.ENTER_FRAME, onEnterFrame)
	_ = willHideAdTimer and willHideAdTimer:stop()
	_ = willShowAdTimer and willShowAdTimer:stop()
	game.running = false
    game:setState(state.exiting)

   _= level ~= nil and level:finalize()
   waitFor.theEnd()

end)

if true then
	mainco = coroutine.create(main)
	names[mainco] = 'main'
	ok, msg = coroutine.resume(mainco)
	if (not ok) then error(msg) end
end
