1. **同轮等待结果**：spawn 之后 SHALL 在本轮内等待（wait）子 agent 返回，收到结果先逐字转达（写入本轮执行日志）再判定；SHALL NOT 在 spawn 后结束本轮回合，留下"子 agent 已返回但主会话已退出、结果无人消费"的断链状态。
2. **禁止口头分发**：每一步 spawn / wait 都 SHALL 落到宿主的实际工具调用，SHALL NOT 仅以自然语言描述"已分发/将分发审查任务给 subagent"代替实际 spawn 调用；出现"我将 spawn…"类描述而没有对应工具调用时，该输出不视为分发动作，不得据此结束本轮或进入下一阶段。
3. **消费完即关闭**：子 agent 结果消费完毕（逐条裁决完成、不再需要该 agent）SHALL 关闭它；SHALL NOT 假设 subagent 跨用户回合存活。
