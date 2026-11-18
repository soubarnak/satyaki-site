public class Main {
    public static void main(String[] args) {
        int[] route = {2, 1};
        int[] turns = {0, 1};
        route[1] = 3;
        for (int i = 0; i < 2; i++) {
            if (turns[i] == 1) {
                turnLeft();
            }
            for (int n = 0; n < route[i]; n++) {
                move();
            }
        }
    }
}
