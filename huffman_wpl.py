import heapq

def calculate_huffman_wpl():
    """
    计算哈夫曼树的带权路径长度(WPL)
    
    输入格式:
    第一行: 正整数 n (2 <= n <= 1000)
    第二行: n个正整数 w1, w2, ..., wn (1 <= wi <= 1000)
    
    输出格式:
    一个整数，表示哈夫曼树的最小带权路径长度(WPL)
    
    算法原理:
    哈夫曼树的WPL等于所有非叶子节点的权值之和
    使用最小堆(优先队列)来高效获取两个最小权值节点
    """
    # 读取输入
    n = int(input())
    weights = list(map(int, input().split()))
    
    # 检查输入是否有效
    if len(weights) != n:
        print("Error: 权值数量与n不匹配")
        return
    
    # 将权值转换为最小堆
    heapq.heapify(weights)
    
    total_wpl = 0
    
    # 构建哈夫曼树，直到堆中只剩一个节点
    while len(weights) > 1:
        # 取出两个最小权值
        min1 = heapq.heappop(weights)
        min2 = heapq.heappop(weights)
        
        # 合并节点，权值为两者之和
        merged = min1 + min2
        
        # 累加到WPL（合并节点即为非叶子节点）
        total_wpl += merged
        
        # 将合并后的节点放回堆
        heapq.heappush(weights, merged)
    
    # 输出结果
    print(total_wpl)

if __name__ == "__main__":
    calculate_huffman_wpl()
