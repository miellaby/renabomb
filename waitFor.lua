require('json')

-- Module to wait for seconds and signals
waitFor = {
	-- few signals
	HELLO = {},
	BEGIN = {},
	PROGRESS = {},
	POKE = {},
	END = {},
	BYEBYE = {},
	TIMEOUT = {},
	
	-- coroutines which waits for some delay
	waitingOnTime = {},

	-- coroutines which wait for some signal
	waitingOnSignal = {},

	-- coroutines which waits for some condition
	waitingOnCondition = {},

	-- signals waited by coroutines
	waitedSignals = {},

	-- time
	now = 0,

	-- usage waitFor.seconds(seconds)
	seconds = function(seconds)
		-- print("wait seconds", seconds)
		local co = coroutine.running()
		assert(co ~= nil, "The main thread cannot wait!")
		-- store coroutine into the waitingOnTime table
		waitFor.waitingOnTime[co] = waitFor.now + seconds
		return coroutine.yield(co)
	end,

	-- usage waitFor.signal(signal, seconds)
	signal = function(signal, during, condition)
		-- print("wait signal", signal.label or signal, during, condition and "condition" or "")
		local co = coroutine.running()
		assert(co ~= nil, "The main thread cannot wait!")
		assert(signal ~= nil, "signal is nil!")

		-- store coroutine into the waitedSignals table
		waitFor.waitedSignals[co] = signal

		-- store coroutine into the waitingOnSignal table
		if waitFor.waitingOnSignal[signal] == nil then
			waitFor.waitingOnSignal[signal] = {}
		end
		waitFor.waitingOnSignal[signal][co] = co

		-- yield or redirect to waitFor.seconds()
		if (condition ~= nil) then
			return waitFor.condition(condition, during)
		elseif (during ~= nil) then
			return waitFor.seconds(during)
		else
			return coroutine.yield()
		end
	end,
	
	condition = function(c, during)
		-- print("waitFor condition", c, during)
		-- not yielding if condition is already verified
		local check0 = c()
		if check0 then
			local co = coroutine.running()
			-- if coroutine was waiting for a timer or signal, also forget it
			local waitedSignal = waitFor.waitedSignals[co]
			if waitedSignal ~= nil then
				waitFor.waitingOnSignal[waitedSignal][co] = nil
			end
			waitFor.waitingOnCondition[co] = nil
			waitFor.waitedSignals[co] = nil
			waitFor.waitingOnTime[co] = nil
			return check0
		end
		
		local co = coroutine.running()
		assert(co ~= nil, "The main thread cannot wait!")
		
		-- store coroutine into the waitingOnCondition table
		waitFor.waitingOnCondition[co] = c
		
		-- yield or redirect to waitFor.seconds()
		if (during == nil) then
			return coroutine.yield()
		else
			return waitFor.seconds(during)
		end
	end,
	
    -- usage waitFor.tick(delta) to be called from main loop
	tick = function(deltaTime)
		assert(deltaTime)
	    -- print("tick start", deltaTime)
		-- update time
		waitFor.now = waitFor.now + (deltaTime or 1)
		
		-- list coroutines to be woken up because time out
		local threadsToWake = {}
		for co, wakeupTime in pairs(waitFor.waitingOnTime) do
			if wakeupTime < waitFor.now then
				table.insert(threadsToWake, co)
			end
		end

		-- unrecord waiters
		for _, co in ipairs(threadsToWake) do
			-- if coroutine was waiting something else, forget it
			local waitedSignal = waitFor.waitedSignals[co]
			if waitedSignal ~= nil then
				waitFor.waitingOnSignal[waitedSignal][co] = nil
			end
			waitFor.waitedSignals[co] = nil
			waitFor.waitingOnCondition[co] = nil

			waitFor.waitingOnTime[co] = nil
		end
		
		-- wake them
		for _, co in ipairs(threadsToWake) do
			-- print("timer resume", names[co])
			local ok, msg = coroutine.resume(co, waitFor.TIMEOUT)
			if not ok then error(msg) end
		end
		
		-- list coroutines to be woken up because condition is checked
		threadsToWake = {}
		for co, condition in pairs(waitFor.waitingOnCondition) do
			-- print("condition", names[co])
			if condition() then
				table.insert(threadsToWake, co)
			end
		end

		-- unrecord waiters
		for _, co in ipairs(threadsToWake) do
			-- if coroutine was waiting for a timer or signal, also forget it
			local waitedSignal = waitFor.waitedSignals[co]
			if waitedSignal ~= nil then
				waitFor.waitingOnSignal[waitedSignal][co] = nil
			end
			waitFor.waitedSignals[co] = nil
			waitFor.waitingOnTime[co] = nil
				
			waitFor.waitingOnCondition[co] = nil
		end
		
		-- wake them
		for _, co in ipairs(threadsToWake) do
			-- print("cdt resume", names[co])

			local ok, msg = coroutine.resume(co, waitFor.POKE)
			if not ok then error(msg) end
		end
		-- print("tick end", deltaTime)
		
	end,

	-- usage waitFor.trigger(someSignal)
	trigger = function(signal, ...)
		assert(signal ~= nil)
		-- print('trigger start')
		-- get signal waiters table
		local cos = waitFor.waitingOnSignal[signal]

		if cos == nil then return end
		
		-- reset table
		waitFor.waitingOnSignal[signal] = nil
		
		-- unrecord waiters
		for _, co in pairs(cos) do
			waitFor.waitingOnTime[co] = nil
			waitFor.waitingOnCondition[co] = nil
			waitFor.waitedSignals[co] = nil
		end
		
		-- resume waiters
		for _, co in pairs(cos) do
			-- print('trigger resume', names[co])
			local args = {co, signal, ...}
			local ok, msg = coroutine.resume(unpack(args))
			if not ok then error(msg) end
		end
		-- print('trigger end')
    end,
	
	triggerEvent = function(event)
		return waitFor.trigger(event.type or Event.COMPLETE, {x = event.x, y = event.y })
	end,
	
	theEnd = function()
		local stillWaiting = true;
		while stillWaiting do
			local wot = waitFor.waitingOnTime
			local woc =	waitFor.waitingOnCondition
			local wos = waitFor.waitedSignals
			waitFor.waitingOnTime = {};
			waitFor.waitingOnCondition = {};
			waitFor.waitedSignals = {};
			waitFor.waitingOnSignal = {};
			stillWaiting = false;
			for co, wakeupTime in pairs(wot) do
				-- print('was waiting on time: ', names[co], co)
				coroutine.resume(co)
				stillWaiting = true;
			end
			for co, condition in pairs(woc) do
				-- print('was waiting on condition: ', names[co], co)			
				coroutine.resume(co)
				stillWaiting = true;
			end
			for co, signal in pairs(wos) do
				-- print('was waiting on signal: ', names[co], co)			
				coroutine.resume(co)
				stillWaiting = true;
			end
		end
	end
}
